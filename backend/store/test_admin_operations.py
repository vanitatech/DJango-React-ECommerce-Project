from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Category, Order, Product


class AdminOperationsSummaryTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="operations-staff",
            password="staff-password",
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username="operations-customer",
            password="customer-password",
        )
        self.category = Category.objects.create(
            name="Operations", slug="operations"
        )

    def test_operations_summary_requires_staff_access(self):
        response = self.client.get(reverse("admin_operations_summary"))
        self.assertEqual(response.status_code, 401)

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(reverse("admin_operations_summary"))
        self.assertEqual(response.status_code, 403)

    def test_summary_counts_statuses_paid_revenue_and_low_stock(self):
        today = timezone.localdate()
        paid_order = Order.objects.create(
            user=self.customer,
            total_amount=Decimal("49.95"),
            status=Order.Status.SHIPPED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        simulated_order = Order.objects.create(
            user=self.customer,
            total_amount=Decimal("100.00"),
            status=Order.Status.PROCESSING,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.SIMULATED,
        )
        unpaid_order = Order.objects.create(
            user=self.customer,
            total_amount=Decimal("200.00"),
            status=Order.Status.AWAITING_PAYMENT,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PENDING,
        )
        Order.objects.filter(pk__in=[paid_order.pk, simulated_order.pk, unpaid_order.pk]).update(
            created_at=timezone.now()
        )
        historical_order = Order.objects.create(
            user=self.customer,
            total_amount=Decimal("500.00"),
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(pk=historical_order.pk).update(
            created_at=timezone.now() - timedelta(days=1)
        )

        low_stock = Product.objects.create(
            category=self.category,
            name="Low-stock cable",
            price="8.00",
            stock_quantity=2,
        )
        Product.objects.create(
            category=self.category,
            name="Well-stocked cable",
            price="9.00",
            stock_quantity=6,
        )
        Product.objects.create(
            category=self.category,
            name="Threshold stock cable",
            price="10.00",
            stock_quantity=5,
        )

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get(reverse("admin_operations_summary"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["date"], today.isoformat())
        self.assertEqual(response.data["today_orders"], 3)
        self.assertEqual(response.data["paid_revenue_today"], "49.95")
        counts = {entry["value"]: entry["count"] for entry in response.data["status_counts"]}
        self.assertEqual(counts[Order.Status.SHIPPED], 1)
        self.assertEqual(counts[Order.Status.PROCESSING], 1)
        self.assertEqual(counts[Order.Status.AWAITING_PAYMENT], 1)
        self.assertEqual(
            [product["id"] for product in response.data["low_stock_products"]],
            [low_stock.id, Product.objects.get(name="Threshold stock cable").id],
        )
        self.assertEqual(response.data["low_stock_threshold"], 5)
