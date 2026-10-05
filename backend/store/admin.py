from django.contrib import admin
from django.conf import settings
from django.utils import timezone
from django.utils.html import format_html
from urllib.parse import quote

from .models import (
    Category,
    ContentBlock,
    ContentPage,
    Order,
    OrderItem,
    PageContentBlock,
    Product,
    ProductImage,
    Review,
    UserProfile,
    WishlistItem,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock_quantity', 'created_at')
    list_filter = ('category',)
    search_fields = ('name', 'description')
    list_editable = ('stock_quantity', 'price')
    inlines = [ProductImageInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'product_name', 'quantity', 'price')
    can_delete = False


class PageContentBlockInline(admin.TabularInline):
    model = PageContentBlock
    extra = 1
    autocomplete_fields = ("block",)
    ordering = ("position", "id")


@admin.register(ContentPage)
class ContentPageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "publication_state",
        "published_at",
        "updated_at",
        "preview_link",
    )
    list_filter = ("is_published", "updated_at")
    search_fields = ("title", "slug", "seo_description")
    prepopulated_fields = {"slug": ("title",)}
    fields = (
        "title",
        "slug",
        "seo_description",
        "is_published",
        "published_at",
        "created_at",
        "updated_at",
    )
    readonly_fields = ("created_at", "updated_at")
    inlines = [PageContentBlockInline]

    @admin.display(description="Publication", ordering="is_published")
    def publication_state(self, obj):
        if not obj.is_published:
            return "Draft"
        if obj.published_at and obj.published_at > timezone.now():
            return "Scheduled"
        return "Published"

    @admin.display(description="Preview")
    def preview_link(self, obj):
        url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/admin/content/"
            f"{quote(obj.slug, safe='')}/preview"
        )
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Preview</a>',
            url,
        )


@admin.register(ContentBlock)
class ContentBlockAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("name", "heading", "body")
    list_editable = ("is_active",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'status',
        'payment_status',
        'carrier',
        'tracking_number',
        'shipped_at',
        'delivered_at',
        'total_amount',
        'payment_method',
        'created_at',
    )
    list_filter = ('status', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('user__username', 'customer_name', 'customer_email', 'phone')
    readonly_fields = (
        'user',
        'created_at',
        'total_amount',
        'customer_name',
        'customer_email',
        'shipping_address',
        'phone',
        'payment_method',
        'payment_status',
        'stripe_session_id',
        'stripe_checkout_url',
        'status',
        'carrier',
        'tracking_number',
        'shipped_at',
        'delivered_at',
    )
    inlines = [OrderItemInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('product__name', 'user__username', 'comment')


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'created_at')
    search_fields = ('user__username', 'product__name')
    list_filter = ('created_at',)


admin.site.register(Category)
admin.site.register(UserProfile)
