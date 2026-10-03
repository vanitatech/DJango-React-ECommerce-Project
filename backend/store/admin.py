from django.contrib import admin

from .models import (
    Category,
    Order,
    OrderItem,
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


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'status',
        'payment_status',
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
    )
    inlines = [OrderItemInline]

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = super().get_readonly_fields(request, obj)
        if obj and obj.payment_status == Order.PaymentStatus.PENDING:
            return (*readonly_fields, 'status')
        return readonly_fields


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
