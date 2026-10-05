from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Order


class AdminOrderFulfilmentTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="fulfilment-staff",
            password="staff-password",
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username="order-customer",
            password="customer-password",
        )
        self.order = Order.objects.create(
            user=self.customer,
            total_amount="25.00",
            customer_name="Order Customer",
            customer_email="customer@example.com",
            shipping_address="10 Market Street",
            phone="0123456789",
        )

    def test_order_queue_requires_staff_access(self):
        response = self.client.get(reverse("admin_order_queue"))
        self.assertEqual(response.status_code, 401)

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(reverse("admin_order_queue"))
        self.assertEqual(response.status_code, 403)

    def test_profile_exposes_staff_flag_for_navigation(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get(reverse("user_profile"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_staff"])

    def test_staff_can_search_and_filter_the_order_queue(self):
        guest_order = Order.objects.create(
            total_amount="12.00",
            customer_name="Guest Customer",
            customer_email="guest@example.com",
        )
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get(
            reverse("admin_order_queue"),
            {"status": Order.Status.PROCESSING, "search": "guest@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [guest_order.id])
        self.assertEqual(response.data[0]["customer_email"], "guest@example.com")

        response = self.client.get(
            reverse("admin_order_queue"),
            {"search": str(self.order.id)},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [self.order.id])

    def test_invalid_status_filter_is_rejected(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get(
            reverse("admin_order_queue"),
            {"status": "NOT_A_STATUS"},
        )

        self.assertEqual(response.status_code, 400)

    def test_staff_can_ship_and_deliver_order_with_tracking(self):
        self.client.force_authenticate(user=self.staff_user)
        update_url = reverse("update_order_fulfilment", args=[self.order.id])

        shipped = self.client.patch(
            update_url,
            {
                "status": Order.Status.SHIPPED,
                "carrier": "Parcel Service",
                "tracking_number": "TRACK-123",
            },
            format="json",
        )

        self.assertEqual(shipped.status_code, 200)
        self.assertEqual(shipped.data["status"], Order.Status.SHIPPED)
        self.assertEqual(shipped.data["carrier"], "Parcel Service")
        self.assertEqual(shipped.data["tracking_number"], "TRACK-123")
        self.assertIsNotNone(shipped.data["shipped_at"])
        shipped_at = shipped.data["shipped_at"]

        delivered = self.client.patch(
            update_url,
            {"status": Order.Status.DELIVERED},
            format="json",
        )

        self.assertEqual(delivered.status_code, 200)
        self.assertEqual(delivered.data["status"], Order.Status.DELIVERED)
        self.assertEqual(delivered.data["shipped_at"], shipped_at)
        self.assertIsNotNone(delivered.data["delivered_at"])

        self.client.force_authenticate(user=self.customer)
        history = self.client.get(reverse("get_orders"))
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data[0]["tracking_number"], "TRACK-123")
        self.assertEqual(history.data[0]["status"], Order.Status.DELIVERED)

    def test_tracking_requires_carrier_and_tracking_number_together(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(
            reverse("update_order_fulfilment", args=[self.order.id]),
            {"carrier": "Parcel Service"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.carrier, "")
        self.assertEqual(self.order.status, Order.Status.PROCESSING)

    def test_fulfilment_transitions_cannot_skip_or_reverse_steps(self):
        self.client.force_authenticate(user=self.staff_user)
        update_url = reverse("update_order_fulfilment", args=[self.order.id])

        skipped = self.client.patch(
            update_url,
            {"status": Order.Status.DELIVERED},
            format="json",
        )
        self.assertEqual(skipped.status_code, 400)

        self.order.status = Order.Status.SHIPPED
        self.order.save(update_fields=["status"])
        reversed_response = self.client.patch(
            update_url,
            {"status": Order.Status.PROCESSING},
            format="json",
        )
        self.assertEqual(reversed_response.status_code, 400)

    def test_awaiting_payment_orders_cannot_be_fulfilled(self):
        self.order.status = Order.Status.AWAITING_PAYMENT
        self.order.save(update_fields=["status"])
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(
            reverse("update_order_fulfilment", args=[self.order.id]),
            {"status": Order.Status.SHIPPED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.AWAITING_PAYMENT)

    def test_unpaid_card_order_cannot_be_fulfilled(self):
        self.order.payment_method = Order.PaymentMethod.CARD
        self.order.payment_status = Order.PaymentStatus.PENDING
        self.order.save(update_fields=["payment_method", "payment_status"])
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(
            reverse("update_order_fulfilment", args=[self.order.id]),
            {"status": Order.Status.SHIPPED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
