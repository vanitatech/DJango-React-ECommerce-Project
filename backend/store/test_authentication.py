from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase


class AuthenticationApiTests(APITestCase):
    def test_registration_creates_user_and_jwt_login_authenticates_profile(self):
        registration = self.client.post(
            reverse("register"),
            {
                "username": "new-shopper",
                "email": "new-shopper@example.com",
                "password": "StrongPassword2026!",
                "password2": "StrongPassword2026!",
            },
            format="json",
        )

        self.assertEqual(registration.status_code, 201)
        user = User.objects.get(username="new-shopper")
        self.assertTrue(user.check_password("StrongPassword2026!"))
        self.assertNotIn("password", registration.data["user"])

        token_response = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "new-shopper", "password": "StrongPassword2026!"},
            format="json",
        )

        self.assertEqual(token_response.status_code, 200)
        self.assertIn("access", token_response.data)
        self.assertIn("refresh", token_response.data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}"
        )
        profile_response = self.client.get(reverse("user_profile"))

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["username"], "new-shopper")
        self.assertEqual(profile_response.data["email"], "new-shopper@example.com")

    def test_registration_rejects_mismatched_passwords_without_creating_user(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "mismatch-shopper",
                "email": "mismatch@example.com",
                "password": "StrongPassword2026!",
                "password2": "DifferentPassword2026!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password2", response.data)
        self.assertFalse(User.objects.filter(username="mismatch-shopper").exists())

    def test_jwt_login_rejects_incorrect_credentials_and_refresh_works(self):
        User.objects.create_user(
            username="registered-shopper",
            password="StrongPassword2026!",
        )

        invalid_login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "registered-shopper", "password": "incorrect"},
            format="json",
        )
        valid_login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "registered-shopper", "password": "StrongPassword2026!"},
            format="json",
        )

        self.assertEqual(invalid_login.status_code, 401)
        self.assertEqual(valid_login.status_code, 200)
        refresh_response = self.client.post(
            reverse("token_refresh"),
            {"refresh": valid_login.data["refresh"]},
            format="json",
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)

    def test_private_customer_endpoints_reject_anonymous_requests(self):
        endpoints = (
            reverse("get_cart"),
            reverse("get_orders"),
            reverse("user_profile"),
            reverse("get_wishlist"),
        )

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, 401)
