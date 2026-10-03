from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Review, UserProfile


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

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

    class Meta:
        model = Order
        fields = [
            "id",
            "created_at",
            "total_amount",
            "customer_name",
            "shipping_address",
            "phone",
            "payment_method",
            "status",
            "items",
        ]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email")

    class Meta:
        model = UserProfile
        fields = ["username", "email", "phone", "address"]

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
        return data

    def create(self, validated_data):
        validated_data.pop("password2", None)
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user
