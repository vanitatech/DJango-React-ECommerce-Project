import os

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("django-insecure-"):
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a private production key of at least 50 characters")
DEBUG = False
ALLOWED_HOSTS = [host.strip() for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if host.strip()]
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must list explicit hostnames")
if not USE_SQLITE and not all(os.getenv(key) for key in ("DB_NAME", "DB_USER", "DB_HOST")):
    raise ImproperlyConfigured("Production PostgreSQL requires DB_NAME, DB_USER and DB_HOST")
FRONTEND_URL = os.environ["FRONTEND_URL"]
if not FRONTEND_URL.startswith("https://"):
    raise ImproperlyConfigured("Production FRONTEND_URL must use HTTPS")
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.getenv("DJANGO_ALLOWED_ORIGINS", "").split(",") if origin.strip()
]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_DOMAIN = None
CSRF_COOKIE_DOMAIN = None
SECURE_SSL_REDIRECT = True
if os.getenv("DJANGO_TRUST_PROXY", "false").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
