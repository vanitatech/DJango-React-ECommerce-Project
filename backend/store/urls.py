from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('products/', views.get_products),
    path('products/<int:pk>/', views.get_product, name='product_detail'),
    path('categories/', views.get_categories),
    path('content/pages/', views.list_published_pages, name='published_pages'),
    path(
        'content/pages/<slug:slug>/',
        views.get_published_page,
        name='published_page',
    ),
    path(
        'admin/content/pages/<slug:slug>/preview/',
        views.preview_content_page,
        name='preview_content_page',
    ),
    path('cart/', views.get_cart, name='get_cart'),
    path('cart/add/', views.add_to_cart, name='cart_add'),
    path('cart/remove/', views.remove_from_cart),
    path('cart/update/', views.update_cart_quantity),
    path('orders/create/', views.create_order, name='create_order'),
    path('orders/track/', views.track_guest_order, name='track_guest_order'),
    path('orders/', views.get_orders, name='get_orders'),
    path('admin/orders/', views.admin_order_queue, name='admin_order_queue'),
    path(
        'admin/operations/summary/',
        views.admin_operations_summary,
        name='admin_operations_summary',
    ),
    path(
        'admin/orders/<int:pk>/',
        views.update_order_fulfilment,
        name='update_order_fulfilment',
    ),
    path('orders/payment-status/', views.stripe_payment_status, name='stripe_payment_status'),
    path('orders/<int:pk>/cancel/', views.cancel_order, name='cancel_order'),
    path('payments/config/', views.payment_config, name='payment_config'),
    path('payments/stripe/webhook/', views.stripe_webhook, name='stripe_webhook'),
    path('profile/', views.user_profile, name='user_profile'),
    path('wishlist/', views.get_wishlist, name='get_wishlist'),
    path('wishlist/<int:product_pk>/', views.update_wishlist, name='update_wishlist'),
    path('products/<int:pk>/reviews/', views.product_reviews, name='product_reviews'),
]