from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', views.register_view),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('products/', views.get_products),
    path('products/<int:pk>/', views.get_product, name='product_detail'),
    path('categories/', views.get_categories),
    path('cart/', views.get_cart),
    path('cart/add/', views.add_to_cart, name='cart_add'),
    path('cart/remove/', views.remove_from_cart),
    path('cart/update/', views.update_cart_quantity),
    path('orders/create/', views.create_order, name='create_order'),
    path('orders/', views.get_orders, name='get_orders'),
    path('orders/<int:pk>/cancel/', views.cancel_order, name='cancel_order'),
    path('profile/', views.user_profile, name='user_profile'),
    path('products/<int:pk>/reviews/', views.product_reviews, name='product_reviews'),
]