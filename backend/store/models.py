from django.db import models

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, URLValidator
from django.utils import timezone


def validate_content_link(value):
    if not value:
        return
    if value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return
    URLValidator(schemes=["https"])(value)

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.PositiveIntegerField(default=10)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    external_image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image_url = models.URLField()
    alt_text = models.CharField(max_length=200, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return f"Image {self.position + 1} for {self.product.name}"


class ContentPage(models.Model):
    title = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    seo_description = models.CharField(max_length=200, blank=True)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set a future time to schedule publication; leave blank to publish immediately.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def save(self, *args, **kwargs):
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        elif not self.is_published:
            self.published_at = None
        if kwargs.get("update_fields") is not None and "is_published" in kwargs["update_fields"]:
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {"published_at"}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ContentBlock(models.Model):
    class Kind(models.TextChoices):
        BANNER = "BANNER", "Banner"
        TEXT = "TEXT", "Text"
        IMAGE = "IMAGE", "Image"

    name = models.CharField(max_length=100, unique=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    heading = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True)
    image_url = models.URLField(
        blank=True,
        validators=[URLValidator(schemes=["https"])],
    )
    image_alt = models.CharField(max_length=200, blank=True)
    button_label = models.CharField(max_length=60, blank=True)
    button_url = models.CharField(
        max_length=500,
        blank=True,
        validators=[validate_content_link],
    )
    is_active = models.BooleanField(default=True)
    pages = models.ManyToManyField(
        ContentPage,
        through="PageContentBlock",
        related_name="content_blocks",
    )

    def clean(self):
        super().clean()
        if bool(self.button_label) != bool(self.button_url):
            raise ValidationError(
                "Provide both the button label and destination, or leave both blank."
            )
        if self.kind == self.Kind.IMAGE and not self.image_url:
            raise ValidationError({"image_url": "Image blocks require an HTTPS image URL."})

    def __str__(self):
        return self.name


class PageContentBlock(models.Model):
    page = models.ForeignKey(
        ContentPage,
        related_name="content_sections",
        on_delete=models.CASCADE,
    )
    block = models.ForeignKey(
        ContentBlock,
        related_name="page_placements",
        on_delete=models.PROTECT,
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["page", "block"],
                name="unique_content_block_per_page",
            )
        ]

    def __str__(self):
        return f"{self.block.name} on {self.page.title}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.user.username

class Order(models.Model):
    class Status(models.TextChoices):
        AWAITING_PAYMENT = 'AWAITING_PAYMENT', 'Awaiting payment'
        PROCESSING = 'PROCESSING', 'Processing'
        SHIPPED = 'SHIPPED', 'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class PaymentMethod(models.TextChoices):
        COD = 'COD', 'Cash on delivery'
        CARD = 'CARD', 'Card (Stripe Checkout)'

    class PaymentStatus(models.TextChoices):
        NOT_REQUIRED = 'NOT_REQUIRED', 'Not required'
        PENDING = 'PENDING', 'Pending'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'
        SIMULATED = 'SIMULATED', 'Simulated'

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    customer_name = models.CharField(max_length=150, blank=True)
    customer_email = models.EmailField(blank=True)
    shipping_address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    payment_method = models.CharField(
        max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.COD
    )
    payment_status = models.CharField(
        max_length=16,
        choices=PaymentStatus.choices,
        default=PaymentStatus.NOT_REQUIRED,
    )
    stripe_session_id = models.CharField(
        max_length=255, blank=True, null=True, unique=True
    )
    stripe_checkout_url = models.URLField(blank=True)
    guest_tracking_token_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        unique=True,
        editable=False,
    )
    carrier = models.CharField(max_length=100, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PROCESSING
    )

    def __str__(self):
        return f"Order {self.id}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    product_name = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product_name or self.product.name}"


class Review(models.Model):
    user = models.ForeignKey(User, related_name='product_reviews', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'product'], name='unique_product_review_per_user'
            )
        ]

    def __str__(self):
        return f"{self.rating}/5 review for {self.product.name} by {self.user.username}"


class WishlistItem(models.Model):
    user = models.ForeignKey(User, related_name='wishlist_items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='wishlisted_by', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'product'], name='unique_wishlist_product_per_user'
            )
        ]

    def __str__(self):
        return f"{self.user.username} saved {self.product.name}"


class Cart(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cart of {self.id} for {self.user}"

    @property
    def total(self):
        return sum(item.subtotal for item in self.items.all())

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def subtotal(self):
        return self.quantity * self.product.price
