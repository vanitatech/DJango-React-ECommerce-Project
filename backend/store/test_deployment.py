import json
import os
import subprocess
import sys
from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.core.handlers.wsgi import WSGIHandler
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import set_script_prefix

from backend.deployment import base_path
from .models import Category, Order, Product
from .views import _create_stripe_checkout_session


class BasePathTests(SimpleTestCase):
    def test_root_and_sub_directory_paths(self):
        self.assertEqual(base_path(), "/")
        self.assertEqual(base_path("/demos/store"), "/demos/store/")
        for value in ("", "demos/store", "//", "/../", "/a//b", "/a?b"):
            with self.assertRaises(ImproperlyConfigured):
                base_path(value)

    def test_production_settings_require_explicit_safe_configuration(self):
        env = {
            **os.environ,
            "DJANGO_SECRET_KEY": "test-production-key-" + "x" * 64,
            "DJANGO_ALLOWED_HOSTS": "vanitatech.co.uk",
            "FRONTEND_URL": "https://vanitatech.co.uk/demos/django-react-ecommerce",
            "APP_BASE_PATH": "/demos/django-react-ecommerce/",
            "USE_SQLITE": "true",
            "DJANGO_TRUST_PROXY": "true",
            "DJANGO_ALLOWED_ORIGINS": "",
        }
        script = (
            "import backend.production_settings as s; "
            "assert not s.DEBUG; "
            "assert s.FORCE_SCRIPT_NAME == '/demos/django-react-ecommerce'; "
            "assert s.STATIC_URL == '/demos/django-react-ecommerce/static/'; "
            "assert s.MEDIA_URL == '/demos/django-react-ecommerce/media/'; "
            "assert s.SESSION_COOKIE_PATH == '/demos/django-react-ecommerce/'; "
            "assert s.CSRF_COOKIE_PATH == s.SESSION_COOKIE_PATH; "
            "assert s.SESSION_COOKIE_NAME == 'vanitacart_sessionid'; "
            "assert s.CSRF_COOKIE_NAME == 'vanitacart_csrftoken'; "
            "assert s.SECURE_PROXY_SSL_HEADER == ('HTTP_X_FORWARDED_PROTO', 'https')"
        )
        valid = subprocess.run([sys.executable, "-c", script], env=env, capture_output=True, text=True)
        self.assertEqual(valid.returncode, 0, valid.stderr)
        for changes, error in (
            ({"DJANGO_SECRET_KEY": ""}, "DJANGO_SECRET_KEY"),
            ({"DJANGO_ALLOWED_HOSTS": "*"}, "DJANGO_ALLOWED_HOSTS"),
            ({"APP_BASE_PATH": "/../"}, "APP_BASE_PATH"),
            ({"FRONTEND_URL": "http://vanitatech.co.uk"}, "HTTPS"),
            ({"USE_SQLITE": "false", "DB_NAME": "", "DB_USER": "", "DB_HOST": ""}, "PostgreSQL"),
        ):
            result = subprocess.run(
                [sys.executable, "-c", "import backend.production_settings"],
                env={**env, **changes}, capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(error, result.stderr)


@override_settings(
    FORCE_SCRIPT_NAME="/demos/django-react-ecommerce",
    MEDIA_URL="/demos/django-react-ecommerce/media/",
    STATIC_URL="/demos/django-react-ecommerce/static/",
    SESSION_COOKIE_PATH="/demos/django-react-ecommerce/",
    CSRF_COOKIE_PATH="/demos/django-react-ecommerce/",
    FRONTEND_URL="https://vanitatech.co.uk/demos/django-react-ecommerce",
    ALLOWED_HOSTS=["vanitatech.co.uk"],
)
class MountedDeploymentTests(TestCase):
    def tearDown(self):
        set_script_prefix("/")

    def request(self, path):
        environ = RequestFactory().get(
            path, HTTP_HOST="vanitatech.co.uk", secure=True
        ).environ
        status = []
        headers = []

        def start_response(response_status, response_headers):
            status.append(response_status)
            headers.extend(response_headers)

        response = WSGIHandler()(environ, start_response)
        body = b"".join(response)
        response.close()
        return status[0], dict(headers), body

    def test_stripped_api_route_returns_prefixed_media_urls(self):
        category = Category.objects.create(name="Demo", slug="demo")
        Product.objects.create(
            category=category, name="Demo product", price=Decimal("5.00"),
            image="products/demo.png",
        )
        status, _, body = self.request("/api/products/")
        self.assertTrue(status.startswith("200"), status)
        products = json.loads(body)
        self.assertEqual(
            products[0]["image"],
            "https://vanitatech.co.uk/demos/django-react-ecommerce/media/products/demo.png",
        )

    def test_admin_redirects_static_links_and_csrf_cookie_stay_inside_mount(self):
        status, headers, _ = self.request("/admin/")
        self.assertTrue(status.startswith("302"), status)
        self.assertTrue(headers["Location"].startswith("/demos/django-react-ecommerce/admin/login/"))
        status, headers, body = self.request("/admin/login/")
        self.assertTrue(status.startswith("200"), status)
        self.assertIn(b"/demos/django-react-ecommerce/static/admin/", body)
        self.assertIn("Path=/demos/django-react-ecommerce/", headers["Set-Cookie"])

    def test_stripe_return_paths_include_mount(self):
        order = Order.objects.create(total_amount=Decimal("5.00"))
        with patch("store.views.stripe.checkout.Session.create") as create:
            _create_stripe_checkout_session(order)
        options = create.call_args.kwargs
        self.assertEqual(
            options["success_url"],
            "https://vanitatech.co.uk/demos/django-react-ecommerce/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        )
        self.assertTrue(options["cancel_url"].startswith(
            "https://vanitatech.co.uk/demos/django-react-ecommerce/checkout?"
        ))
