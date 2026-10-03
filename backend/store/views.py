import logging
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    Product,
    Review,
    UserProfile,
    WishlistItem,
)
from .serializers import (
    CartItemSerializer,
    CartSerializer,
    CategorySerializer,
    GuestOrderItemSerializer,
    OrderSerializer,
    ProductSerializer,
    RegisterSerializer,
    ReviewSerializer,
    UserProfileSerializer,
    UserSerializer,
)


logger = logging.getLogger(__name__)


def _stripe_is_configured():
    return bool(
        settings.STRIPE_SECRET_KEY.startswith("sk_test_")
        and settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_")
    )


def _create_stripe_checkout_session(order):
    currency = settings.STRIPE_CURRENCY.lower()
    line_items = [
        {
            "price_data": {
                "currency": currency,
                "unit_amount": int(item.price * Decimal("100")),
                "product_data": {"name": item.product_name},
            },
            "quantity": item.quantity,
        }
        for item in order.items.all()
    ]
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=line_items,
        customer_email=order.customer_email or None,
        client_reference_id=str(order.pk),
        metadata={"order_id": str(order.pk)},
        payment_intent_data={"metadata": {"order_id": str(order.pk)}},
        success_url=f"{frontend_url}/checkout/return?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend_url}/checkout?payment=cancelled&order_id={order.pk}",
        expires_at=int(timezone.now().timestamp()) + 31 * 60,
    )


@transaction.atomic
def _apply_stripe_checkout_session(session, event_type):
    session_id = session.get("id")
    order_id = (session.get("metadata") or {}).get("order_id")
    if not session_id or not order_id:
        return None, "invalid_session"

    try:
        order = Order.objects.select_for_update().get(
            pk=order_id,
            stripe_session_id=session_id,
            payment_method=Order.PaymentMethod.CARD,
        )
    except Order.DoesNotExist:
        return None, "order_not_found"

    expected_amount = int(order.total_amount * Decimal("100"))
    if (
        session.get("amount_total") != expected_amount
        or session.get("currency") != settings.STRIPE_CURRENCY.lower()
    ):
        return None, "amount_mismatch"

    if event_type == "checkout.session.completed":
        if session.get("payment_status") != "paid":
            return order, None
        if (
            order.status == Order.Status.AWAITING_PAYMENT
            and order.payment_status == Order.PaymentStatus.PENDING
        ):
            order.status = Order.Status.PROCESSING
            order.payment_status = Order.PaymentStatus.PAID
            order.save(update_fields=["status", "payment_status"])
        return order, None

    if event_type in {
        "checkout.session.expired",
        "checkout.session.async_payment_failed",
    } and (
        order.status == Order.Status.AWAITING_PAYMENT
        and order.payment_status == Order.PaymentStatus.PENDING
    ):
        order_items = list(order.items.order_by("product_id"))
        product_ids = sorted({item.product_id for item in order_items})
        products = {
            product.pk: product
            for product in Product.objects.select_for_update()
            .filter(pk__in=product_ids)
            .order_by("pk")
        }
        for item in order_items:
            product = products[item.product_id]
            product.stock_quantity += item.quantity
            product.save(update_fields=["stock_quantity"])

        order.status = Order.Status.CANCELLED
        order.payment_status = Order.PaymentStatus.FAILED
        order.stripe_checkout_url = ""
        order.save(
            update_fields=["status", "payment_status", "stripe_checkout_url"]
        )

    return order, None


def home(request):
    return JsonResponse({"message": "Welcome to the E-Commerce Store!"})


@api_view(["GET"])
def get_products(request):
    products = (
        Product.objects.select_related("category")
        .prefetch_related("reviews", "images")
        .all()
    )
    query = request.query_params.get("search", "").strip()
    category = request.query_params.get("category")

    if category and category != "all":
        products = products.filter(category__slug=category)

    if query:
        products = products.filter(name__icontains=query)

    products = products.order_by("-created_at", "name")
    serializer = ProductSerializer(products, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
def get_product(request, pk):
    try:
        product = (
            Product.objects.select_related("category")
            .prefetch_related("reviews", "images")
            .get(id=pk)
        )
        serializer = ProductSerializer(product, context={"request": request})
        return Response(serializer.data)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=404)


@api_view(["GET"])
def get_categories(request):
    categories = Category.objects.all().order_by("name")
    serializer = CategorySerializer(categories, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    cart, _ = Cart.objects.get_or_create(user=request.user)
    serializer = CartSerializer(cart)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def add_to_cart(request):
    product_id = request.data.get("product_id")
    if not product_id:
        return Response({"error": "Product ID is required"}, status=400)

    try:
        quantity = serializers.IntegerField(min_value=1).run_validation(
            request.data.get("quantity", 1)
        )
    except serializers.ValidationError:
        return Response({"error": "Quantity must be a valid positive number."}, status=400)

    try:
        product = Product.objects.select_for_update().get(id=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=404)

    cart, _ = Cart.objects.get_or_create(user=request.user)
    item, created = CartItem.objects.get_or_create(
        cart=cart, product=product, defaults={"quantity": quantity}
    )

    existing_quantity = 0 if created else item.quantity
    next_quantity = existing_quantity + quantity
    if next_quantity > product.stock_quantity:
        if created:
            item.delete()
        available_to_add = max(product.stock_quantity - existing_quantity, 0)
        return Response(
            {"error": f"Only {available_to_add} units are available to add."},
            status=400,
        )

    if not created:
        item.quantity = next_quantity
        item.save(update_fields=["quantity"])

    return Response({"message": "Product added to cart", "cart": CartSerializer(cart).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_cart_quantity(request):
    item_id = request.data.get("item_id")
    quantity = request.data.get("quantity")

    if not item_id or quantity is None:
        return Response({"error": "Item ID and quantity are required"}, status=400)

    try:
        item = CartItem.objects.get(id=item_id, cart__user=request.user)
    except CartItem.DoesNotExist:
        return Response({"error": "Cart item not found"}, status=404)

    try:
        next_quantity = int(quantity)
    except (TypeError, ValueError):
        return Response({"error": "Quantity must be a valid number"}, status=400)

    if next_quantity < 1:
        item.delete()
        return Response({"message": "Item removed from cart"}, status=200)

    if next_quantity > item.product.stock_quantity:
        return Response(
            {"error": f"Only {item.product.stock_quantity} units are currently available."},
            status=400,
        )

    item.quantity = next_quantity
    item.save()
    return Response(CartItemSerializer(item).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_from_cart(request):
    item_id = request.data.get("item_id")
    if not item_id:
        return Response({"error": "Item ID is required"}, status=400)

    deleted, _ = CartItem.objects.filter(id=item_id, cart__user=request.user).delete()
    if deleted == 0:
        return Response({"error": "Cart item not found"}, status=404)

    return Response({"message": "Item removed from cart"})


@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def create_order(request):
    data = request.data
    try:
        name = serializers.CharField(max_length=150).run_validation(data.get("name"))
        address = serializers.CharField().run_validation(data.get("address"))
        phone = serializers.CharField(max_length=30).run_validation(data.get("phone"))
    except serializers.ValidationError:
        return Response(
            {"error": "Name, address, and phone number are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payment_method = data.get("payment_method") or data.get("payment_Method") or "COD"
    email = data.get("email", "")
    if email:
        try:
            email = serializers.EmailField().run_validation(email)
        except serializers.ValidationError:
            return Response({"error": "Enter a valid email address."}, status=400)

    if not name or not address or not phone:
        return Response({"error": "Name, address, and phone number are required."}, status=400)

    if not phone.isdigit() or len(phone) < 8:
        return Response({"error": "Invalid phone number."}, status=400)

    if not request.user.is_authenticated and not email:
        return Response({"error": "An email address is required for guest checkout."}, status=400)

    if payment_method not in Order.PaymentMethod.values:
        return Response({"error": "Invalid payment method."}, status=400)

    if (
        payment_method == Order.PaymentMethod.CARD
        and not _stripe_is_configured()
    ):
        return Response(
            {"error": "Card payments are not configured. Choose cash on delivery or try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    cart = None
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_items = list(cart.items.all())
        if not cart_items:
            return Response({"error": "Cart is empty"}, status=400)
        quantities = {}
        for item in cart_items:
            quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
    else:
        item_serializer = serializers.ListSerializer(
            child=GuestOrderItemSerializer(),
            data=data.get("items"),
            allow_empty=False,
        )
        if not item_serializer.is_valid():
            return Response(
                {"error": "Provide cart items with valid products and positive quantities."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        guest_items = item_serializer.validated_data
        product_ids = [item["product_id"] for item in guest_items]
        if len(product_ids) != len(set(product_ids)):
            return Response(
                {"error": "Each product may only appear once in the guest cart."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        quantities = {item["product_id"]: item["quantity"] for item in guest_items}

    locked_products = {
        product.pk: product
        for product in Product.objects.select_for_update()
        .filter(pk__in=sorted(quantities))
        .order_by("pk")
    }
    if len(locked_products) != len(quantities):
        return Response({"error": "A product in your cart is no longer available."}, status=400)

    for product_id, quantity in quantities.items():
        product = locked_products[product_id]
        if quantity > product.stock_quantity:
            return Response(
                {
                    "error": (
                        f"Only {product.stock_quantity} units of {product.name} "
                        "are currently available."
                    )
                },
                status=400,
            )

    total = sum(
        locked_products[product_id].price * quantity
        for product_id, quantity in quantities.items()
    )

    order = Order.objects.create(
        user=request.user if request.user.is_authenticated else None,
        total_amount=total,
        customer_name=name,
        customer_email=email or (request.user.email if request.user.is_authenticated else ""),
        shipping_address=address,
        phone=phone,
        payment_method=payment_method,
        payment_status=(
            Order.PaymentStatus.PENDING
            if payment_method == Order.PaymentMethod.CARD
            else Order.PaymentStatus.NOT_REQUIRED
        ),
        status=(
            Order.Status.AWAITING_PAYMENT
            if payment_method == Order.PaymentMethod.CARD
            else Order.Status.PROCESSING
        ),
    )

    for product_id, quantity in quantities.items():
        product = locked_products[product_id]
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            quantity=quantity,
            price=product.price,
        )
        product.stock_quantity -= quantity
        product.save(update_fields=["stock_quantity"])

    checkout_session = None
    if payment_method == Order.PaymentMethod.CARD:
        try:
            checkout_session = _create_stripe_checkout_session(order)
        except stripe.StripeError:
            logger.exception("Stripe Checkout Session creation failed for order %s", order.pk)
            transaction.set_rollback(True)
            return Response(
                {"error": "Card checkout is temporarily unavailable. Your cart has not been charged."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        order.stripe_session_id = checkout_session.id
        order.stripe_checkout_url = checkout_session.url
        order.save(update_fields=["stripe_session_id", "stripe_checkout_url"])

    if cart is not None:
        cart.items.all().delete()

    return Response(
        {
            "message": "Order created successfully",
            "order_id": order.id,
            "total": float(total),
            "payment_method": payment_method,
            "status": order.status,
            "payment_status": order.payment_status,
            "checkout_url": checkout_session.url if checkout_session else None,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def payment_config(request):
    return Response(
        {
            "stripe_enabled": _stripe_is_configured(),
            "currency": settings.STRIPE_CURRENCY.lower(),
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    if not _stripe_is_configured():
        return Response(
            {"error": "Stripe webhooks are not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    signature = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(
            request.body,
            signature,
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.SignatureVerificationError):
        return Response({"error": "Invalid Stripe webhook signature."}, status=400)

    event_type = event["type"]
    if event_type not in {
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_failed",
    }:
        return Response({"received": True})

    order, error = _apply_stripe_checkout_session(
        event["data"]["object"],
        event_type,
    )
    if error == "order_not_found":
        logger.warning("Stripe event %s has no matching order.", event.get("id"))
        return Response(
            {"error": "The order is not available yet. Stripe should retry this event."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if error:
        logger.error("Stripe event %s failed validation: %s", event.get("id"), error)
        return Response({"error": "Stripe event does not match the pending order."}, status=400)

    return Response({"received": True, "order_id": order.pk})


@api_view(["GET"])
@permission_classes([AllowAny])
def stripe_payment_status(request):
    session_id = request.query_params.get("session_id", "")
    order = Order.objects.filter(
        stripe_session_id=session_id,
        payment_method=Order.PaymentMethod.CARD,
    ).first()
    if not order or (
        request.user.is_authenticated and order.user_id != request.user.id
    ):
        return Response({"error": "Payment session not found."}, status=404)

    if order.payment_status == Order.PaymentStatus.PENDING:
        if not _stripe_is_configured():
            return Response(
                {"error": "Stripe test-mode payment verification is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except stripe.StripeError:
            logger.exception("Unable to retrieve Stripe session for order %s", order.pk)
            return Response(
                {"error": "Unable to verify payment with Stripe. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        event_type = {
            ("complete", "paid"): "checkout.session.completed",
            ("expired", "unpaid"): "checkout.session.expired",
        }.get((session.status, session.payment_status))
        if event_type:
            order, error = _apply_stripe_checkout_session(session, event_type)
            if error:
                logger.error("Stripe session for order %s failed validation: %s", order.pk, error)
                return Response({"error": "Stripe session does not match the order."}, status=400)

    return Response(
        {
            "order_id": order.pk,
            "status": order.status,
            "payment_status": order.payment_status,
            "total": float(order.total_amount),
            "checkout_url": order.stripe_checkout_url,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_orders(request):
    orders = (
        Order.objects.filter(user=request.user)
        .prefetch_related("items")
        .order_by("-created_at")
    )
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_wishlist(request):
    products = (
        Product.objects.filter(wishlisted_by__user=request.user)
        .select_related("category")
        .prefetch_related("reviews", "images")
        .order_by("name")
    )
    return Response(ProductSerializer(products, many=True, context={"request": request}).data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def update_wishlist(request, product_pk):
    try:
        product = Product.objects.select_related("category").prefetch_related("reviews").get(
            pk=product_pk
        )
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        deleted, _ = WishlistItem.objects.filter(user=request.user, product=product).delete()
        if not deleted:
            return Response(
                {"error": "Product is not in your wishlist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    _, created = WishlistItem.objects.get_or_create(user=request.user, product=product)
    serializer = ProductSerializer(product, context={"request": request})
    return Response(
        serializer.data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def user_profile(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if request.method == "GET":
        return Response(UserProfileSerializer(profile).data)

    partial = request.method == "PATCH"
    serializer = UserProfileSerializer(
        profile, data=request.data, partial=partial, context={"request": request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def cancel_order(request, pk):
    try:
        order = Order.objects.select_for_update().get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if (
        order.payment_method == Order.PaymentMethod.CARD
        and order.payment_status == Order.PaymentStatus.PAID
    ):
        return Response(
            {"error": "Paid card orders cannot be cancelled without a Stripe refund. Please contact support."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if order.status != Order.Status.PROCESSING:
        return Response(
            {"error": "Only processing orders can be cancelled."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    items = list(order.items.order_by("product_id").all())
    for item in items:
        product = Product.objects.select_for_update().get(pk=item.product_id)
        product.stock_quantity += item.quantity
        product.save(update_fields=["stock_quantity"])

    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])
    return Response(OrderSerializer(order).data)


@api_view(["GET", "POST", "PATCH"])
def product_reviews(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        reviews = Review.objects.filter(product=product).select_related("user")
        return Response(
            ReviewSerializer(
                reviews,
                many=True,
                context={"request": request},
            ).data
        )

    if not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if request.method == "PATCH":
        try:
            review = Review.objects.get(product=product, user=request.user)
        except Review.DoesNotExist:
            return Response(
                {"error": "You have not reviewed this product."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReviewSerializer(
            review,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    if Review.objects.filter(product=product, user=request.user).exists():
        return Response(
            {"error": "You have already reviewed this product."},
            status=status.HTTP_409_CONFLICT,
        )

    serializer = ReviewSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            review = serializer.save(product=product, user=request.user)
    except IntegrityError:
        return Response(
            {"error": "You have already reviewed this product."},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(
        ReviewSerializer(review, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {"message": "User Created Successfully", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
