from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Cart,
    CartItem,
    Category,
    ContentBlock,
    ContentPage,
    Order,
    OrderItem,
    Product,
    ProductImage,
    Review,
    UserProfile,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image_url", "alt_text", "position"]
        read_only_fields = fields


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = "__all__"

    def get_average_rating(self, product):
        ratings = [review.rating for review in product.reviews.all()]
        if not ratings:
            return None
        return round(sum(ratings) / len(ratings), 1)

    def get_review_count(self, product):
        return len(product.reviews.all())


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_price = serializers.DecimalField(
        source="product.price", max_digits=10, decimal_places=2, read_only=True
    )
    product_image = serializers.ImageField(source="product.image", read_only=True)
    product_external_image_url = serializers.URLField(
        source="product.external_image_url", read_only=True
    )
    product_stock = serializers.IntegerField(source="product.stock_quantity", read_only=True)

    class Meta:
        model = CartItem
        fields = [
            "id",
            "quantity",
            "product",
            "product_name",
            "product_price",
            "product_image",
            "product_external_image_url",
            "product_stock",
        ]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.ReadOnlyField()

    class Meta:
        model = Cart
        fields = ["id", "user", "created_at", "items", "total"]


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "username", "is_owner", "rating", "comment", "created_at", "updated_at"]
        read_only_fields = ["id", "username", "is_owner", "created_at", "updated_at"]

    def get_is_owner(self, review):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and review.user_id == request.user.id)


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "price"]
        read_only_fields = fields

    def get_product_name(self, item):
        return item.product_name or item.product.name


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    checkout_url = serializers.URLField(
        source="stripe_checkout_url",
        read_only=True,
        allow_blank=True,
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "created_at",
            "total_amount",
            "customer_name",
            "customer_email",
            "shipping_address",
            "phone",
            "payment_method",
            "payment_status",
            "status",
            "carrier",
            "tracking_number",
            "shipped_at",
            "delivered_at",
            "checkout_url",
            "items",
        ]
        read_only_fields = fields


class OrderFulfilmentSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[Order.Status.SHIPPED, Order.Status.DELIVERED],
        required=False,
    )
    carrier = serializers.CharField(max_length=100, allow_blank=True, required=False)
    tracking_number = serializers.CharField(
        max_length=100, allow_blank=True, required=False
    )

    def validate(self, attrs):
        order = self.instance
        if order.status not in {Order.Status.PROCESSING, Order.Status.SHIPPED}:
            raise serializers.ValidationError(
                "Only processing or shipped orders can be updated for fulfilment."
            )
        if (
            order.payment_method == Order.PaymentMethod.CARD
            and order.payment_status
            not in {Order.PaymentStatus.PAID, Order.PaymentStatus.SIMULATED}
        ):
            raise serializers.ValidationError(
                "Card payment must be complete before fulfilment."
            )

        carrier = attrs.get("carrier", order.carrier)
        tracking_number = attrs.get("tracking_number", order.tracking_number)
        if bool(carrier) != bool(tracking_number):
            raise serializers.ValidationError(
                "Provide both the carrier and tracking number, or leave both blank."
            )

        next_status = attrs.get("status", order.status)
        if (
            next_status != order.status
            and (order.status, next_status)
            not in {
                (Order.Status.PROCESSING, Order.Status.SHIPPED),
                (Order.Status.SHIPPED, Order.Status.DELIVERED),
            }
        ):
            raise serializers.ValidationError(
                "Orders can only move from processing to shipped, then delivered."
            )
        return attrs


class GuestOrderTrackingSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "created_at",
            "total_amount",
            "status",
            "carrier",
            "tracking_number",
            "shipped_at",
            "delivered_at",
            "items",
        ]


class ContentBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = [
            "id",
            "name",
            "kind",
            "heading",
            "body",
            "image_url",
            "image_alt",
            "button_label",
            "button_url",
        ]


class ContentPageSerializer(serializers.ModelSerializer):
    sections = serializers.SerializerMethodField()
    publication_state = serializers.SerializerMethodField()

    class Meta:
        model = ContentPage
        fields = [
            "title",
            "slug",
            "seo_description",
            "is_published",
            "published_at",
            "publication_state",
            "sections",
        ]

    def get_publication_state(self, page):
        if not page.is_published:
            return "draft"
        if page.published_at and page.published_at > timezone.now():
            return "scheduled"
        return "published"

    def get_sections(self, page):
        blocks = (
            ContentBlock.objects.filter(
                page_placements__page=page,
                is_active=True,
            )
            .order_by("page_placements__position", "page_placements__id")
            .distinct()
        )
        return ContentBlockSerializer(blocks, many=True).data


class GuestOrderItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email")
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["username", "email", "phone", "address", "is_staff"]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        instance.phone = validated_data.get("phone", instance.phone)
        instance.address = validated_data.get("address", instance.address)
        instance.save(update_fields=["phone", "address"])

        if "email" in user_data:
            instance.user.email = user_data["email"]
            instance.user.save(update_fields=["email"])

        return instance


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "password2"]

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        user = User(username=data["username"], email=data.get("email", ""))
        try:
            validate_password(data["password"], user=user)
        except ValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return data

    def create(self, validated_data):
        validated_data.pop("password2", None)
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user
