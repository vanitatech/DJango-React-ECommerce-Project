from django.contrib.auth.models import User
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Cart, CartItem, Category, Order, OrderItem, Product
from .serializers import (
    CartItemSerializer,
    CartSerializer,
    CategorySerializer,
    ProductSerializer,
    RegisterSerializer,
    UserSerializer,
)


def home(request):
    return JsonResponse({"message": "Welcome to the E-Commerce Store!"})


@api_view(["GET"])
def get_products(request):
    products = Product.objects.select_related("category").all()
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
        product = Product.objects.select_related("category").get(id=pk)
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
def add_to_cart(request):
    product_id = request.data.get("product_id")
    if not product_id:
        return Response({"error": "Product ID is required"}, status=400)

    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=404)

    cart, _ = Cart.objects.get_or_create(user=request.user)
    item, created = CartItem.objects.get_or_create(cart=cart, product=product)

    if not created:
        item.quantity += 1
        item.save()

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
@permission_classes([IsAuthenticated])
def create_order(request):
    data = request.data
    name = (data.get("name") or "").strip()
    address = (data.get("address") or "").strip()
    phone = (data.get("phone") or "").strip()
    payment_method = data.get("payment_method") or data.get("payment_Method") or "COD"

    if not name or not address or not phone:
        return Response({"error": "Name, address, and phone number are required."}, status=400)

    if not phone.isdigit() or len(phone) < 8:
        return Response({"error": "Invalid phone number."}, status=400)

    cart, _ = Cart.objects.get_or_create(user=request.user)
    if not cart.items.exists():
        return Response({"error": "Cart is empty"}, status=400)

    total = sum(item.product.price * item.quantity for item in cart.items.all())

    order = Order.objects.create(
        user=request.user,
        total_amount=total,
    )

    for item in cart.items.all():
        OrderItem.objects.create(
            order=order,
            product=item.product,
            quantity=item.quantity,
            price=item.product.price,
        )

    cart.items.all().delete()

    return Response(
        {
            "message": "Order created successfully",
            "order_id": order.id,
            "total": float(total),
            "payment_method": payment_method,
            "customer_name": name,
            "shipping_address": address,
        },
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
