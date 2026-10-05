from decimal import Decimal
import hashlib

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Cart, CartItem, Category, Order, OrderItem, Product


class CustomerJourneyApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name="Journey Products",
            slug="journey-products",
        )
        self.product = Product.objects.create(
            category=self.category,
            name="Journey Test Lamp",
            price=Decimal("18.50"),
            stock_quantity=5,
        )

    def test_registered_customer_can_purchase_review_history_and_cancel_order(self):
        registration = self.client.post(
            reverse("register"),
            {
                "username": "journey-shopper",
                "email": "journey@example.com",
                "password": "StrongPassword2026!",
                "password2": "StrongPassword2026!",
            },
            format="json",
        )
        self.assertEqual(registration.status_code, 201)

        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "journey-shopper", "password": "StrongPassword2026!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        add_response = self.client.post(
            reverse("cart_add"),
            {"product_id": self.product.pk, "quantity": 2},
            format="json",
        )
        self.assertEqual(add_response.status_code, 200)
        self.assertEqual(add_response.data["cart"]["items"][0]["quantity"], 2)

        checkout = self.client.post(
            reverse("create_order"),
            {
                "name": "Journey Shopper",
                "address": "42 Test Avenue",
                "phone": "0123456789",
                "payment_method": "COD",
            },
            format="json",
        )
        self.assertEqual(checkout.status_code, 201)
        order = Order.objects.get(pk=checkout.data["order_id"])
        self.assertEqual(order.total_amount, Decimal("37.00"))
        self.assertEqual(order.user.username, "journey-shopper")
        self.assertEqual(order.items.get().product_name, self.product.name)
        self.assertIsNone(order.guest_tracking_token_hash)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 3)

        history = self.client.get(reverse("get_orders"))
        self.assertEqual(history.status_code, 200)
        self.assertEqual([entry["id"] for entry in history.data], [order.pk])
        self.assertEqual(history.data[0]["items"][0]["quantity"], 2)

        cancellation = self.client.post(reverse("cancel_order", args=[order.pk]))
        self.assertEqual(cancellation.status_code, 200)
        self.assertEqual(cancellation.data["status"], Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 5)

    def test_guest_can_complete_order_without_account_or_persistent_user_cart(self):
        self.client.force_authenticate(user=None)
        checkout = self.client.post(
            reverse("create_order"),
            {
                "name": "Guest Journey Shopper",
                "email": "guest-journey@example.com",
                "address": "8 Guest Lane",
                "phone": "0123456789",
                "payment_method": "COD",
                "items": [{"product_id": self.product.pk, "quantity": 1}],
            },
            format="json",
        )

        self.assertEqual(checkout.status_code, 201)
        order = Order.objects.get(pk=checkout.data["order_id"])
        self.assertIsNone(order.user)
        self.assertEqual(order.customer_email, "guest-journey@example.com")
        self.assertEqual(order.total_amount, Decimal("18.50"))
        self.assertFalse(Cart.objects.filter(user__isnull=True).exists())
        self.assertEqual(CartItem.objects.count(), 0)
        self.assertEqual(OrderItem.objects.filter(order=order).count(), 1)
        token = checkout.data["guest_tracking_token"]
        self.assertEqual(len(token), 43)
        self.assertEqual(
            order.guest_tracking_token_hash,
            hashlib.sha256(token.encode("utf-8")).hexdigest(),
        )

        tracking = self.client.post(
            reverse("track_guest_order"),
            {"token": token},
            format="json",
        )
        self.assertEqual(tracking.status_code, 200)
        self.assertEqual(tracking.data["id"], order.id)
        self.assertEqual(tracking.data["status"], Order.Status.PROCESSING)
        self.assertEqual(tracking.data["items"][0]["product_name"], self.product.name)
        self.assertNotIn("customer_email", tracking.data)
        self.assertNotIn("phone", tracking.data)
        self.assertNotIn("shipping_address", tracking.data)
        self.assertNotIn("guest_tracking_token_hash", tracking.data)
        self.assertEqual(tracking["Cache-Control"], "no-store")

        self.assertEqual(self.client.get(reverse("get_orders")).status_code, 401)

    def test_guest_order_tracking_rejects_invalid_and_unknown_tokens(self):
        self.client.force_authenticate(user=None)

        malformed = self.client.post(
            reverse("track_guest_order"),
            {"token": "bad-token"},
            format="json",
        )
        unknown = self.client.post(
            reverse("track_guest_order"),
            {"token": "A" * 43},
            format="json",
        )

        self.assertEqual(malformed.status_code, 404)
        self.assertEqual(unknown.status_code, 404)
