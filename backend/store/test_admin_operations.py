from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import Category, Order, Product


class AdminOperationsDashboardTests(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_superuser(
            username="operations-staff",
            email="operations@example.com",
            password="staff-password",
        )
        self.customer = User.objects.create_user(
            username="operations-customer",
            password="customer-password",
        )
        self.category = Category.objects.create(
            name="Operations", slug="operations"
        )

    def test_operations_dashboard_is_available_to_staff_from_admin_index(self):
        self.client.force_login(self.staff_user)

        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("Operations overview", response.content.decode())
        self.assertIn("Orders by status", response.content.decode())
        self.assertIn("Low-stock alerts", response.content.decode())
        self.assertIn("Open order management", response.content.decode())

    def test_nonstaff_user_cannot_access_dashboard(self):
        self.client.force_login(self.customer)

        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("admin:login"), response.url)

    def test_staff_only_sees_dashboard_sections_allowed_by_model_permissions(self):
        limited_staff = User.objects.create_user(
            username="limited-operations-staff",
            password="staff-password",
            is_staff=True,
        )
        self.client.force_login(limited_staff)

        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Confirmed card revenue today")
        self.assertNotContains(response, "Low-stock alerts")

    def test_dashboard_counts_statuses_revenue_and_low_stock(self):
        now = timezone.now()
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
        Order.objects.filter(
            pk__in=[paid_order.pk, simulated_order.pk, unpaid_order.pk]
        ).update(created_at=now)
        historical_order = Order.objects.create(
            user=self.customer,
            total_amount=Decimal("500.00"),
            status=Order.Status.DELIVERED,
            payment_method=Order.PaymentMethod.CARD,
            payment_status=Order.PaymentStatus.PAID,
        )
        Order.objects.filter(pk=historical_order.pk).update(
            created_at=now - timedelta(days=1)
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
        threshold_stock = Product.objects.create(
            category=self.category,
            name="Threshold stock cable",
            price="10.00",
            stock_quantity=5,
        )

        self.client.force_login(self.staff_user)
        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 200)
        operations = response.context["operations"]
        self.assertEqual(operations["today_orders"], 3)
        self.assertEqual(operations["paid_revenue_today"], "49.95")
        counts = {entry["value"]: entry["count"] for entry in operations["status_counts"]}
        self.assertEqual(counts[Order.Status.SHIPPED], 1)
        self.assertEqual(counts[Order.Status.PROCESSING], 1)
        self.assertEqual(counts[Order.Status.AWAITING_PAYMENT], 1)
        self.assertEqual(
            [product["id"] for product in operations["low_stock_products"]],
            [low_stock.id, threshold_stock.id],
        )
        self.assertContains(response, "Low-stock cable")
