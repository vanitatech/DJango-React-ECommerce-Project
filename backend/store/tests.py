from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Review


class StoreFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="shopper", password="strong-test-password")
        self.other_user = User.objects.create_user(
            username="another-shopper", password="strong-test-password"
        )
        self.category = Category.objects.create(name="Accessories", slug="accessories")
        self.product = Product.objects.create(
            category=self.category,
            name="Canvas Bag",
            description="Everyday carry bag",
            price="25.00",
            stock_quantity=4,
        )
        self.client.force_authenticate(user=self.user)

    def test_checkout_creates_order_snapshot_and_decrements_inventory(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)

        response = self.client.post(
            reverse("create_order"),
            {
                "name": "Shopper Name",
                "address": "10 Market Street",
                "phone": "0123456789",
                "payment_method": "COD",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(pk=response.data["order_id"])
        item = order.items.get()
        self.product.refresh_from_db()
        self.assertEqual(order.customer_name, "Shopper Name")
        self.assertEqual(order.shipping_address, "10 Market Street")
        self.assertEqual(order.status, Order.Status.PROCESSING)
        self.assertEqual(item.product_name, "Canvas Bag")
        self.assertEqual(item.price, self.product.price)
        self.assertEqual(self.product.stock_quantity, 2)
        self.assertFalse(cart.items.exists())

    def test_checkout_rejects_insufficient_stock_without_partial_order(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=5)

        response = self.client.post(
            reverse("create_order"),
            {
                "name": "Shopper Name",
                "address": "10 Market Street",
                "phone": "0123456789",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 4)
        self.assertTrue(cart.items.exists())

    def test_cart_cannot_exceed_available_stock(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=4)

        response = self.client.post(
            reverse("cart_add"),
            {"product_id": self.product.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(cart.items.get().quantity, 4)

    def test_order_history_only_returns_current_users_orders(self):
        own_order = Order.objects.create(
            user=self.user,
            total_amount="25.00",
            customer_name="Shopper Name",
            shipping_address="10 Market Street",
        )
        OrderItem.objects.create(
            order=own_order,
            product=self.product,
            product_name=self.product.name,
            quantity=1,
            price=self.product.price,
        )
        Order.objects.create(user=self.other_user, total_amount="99.00")

        response = self.client.get(reverse("get_orders"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], own_order.id)
        self.assertEqual(response.data[0]["items"][0]["product_name"], "Canvas Bag")

    def test_product_review_is_public_to_read_and_limited_to_one_per_user(self):
        create_response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 5, "comment": "Excellent quality"},
            format="json",
        )
        duplicate_response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 4, "comment": "Another review"},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(duplicate_response.status_code, 409)
        self.assertEqual(Review.objects.filter(product=self.product, user=self.user).count(), 1)

        self.client.force_authenticate(user=None)
        list_response = self.client.get(reverse("product_reviews", args=[self.product.id]))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data[0]["username"], self.user.username)

        product_response = self.client.get(reverse("product_detail", args=[self.product.id]))
        self.assertEqual(product_response.data["review_count"], 1)
        self.assertEqual(product_response.data["average_rating"], 5.0)

    def test_product_review_rejects_out_of_range_rating(self):
        response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 6, "comment": "Invalid rating"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Review.objects.count(), 0)

    def test_anonymous_customer_cannot_submit_review(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 5, "comment": "Unauthenticated review"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(Review.objects.count(), 0)
