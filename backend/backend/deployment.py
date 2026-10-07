import re

from django.core.exceptions import ImproperlyConfigured


def base_path(value="/"):
    if not re.fullmatch(r"/(?:[A-Za-z0-9_-]+/?)*", value):
        raise ImproperlyConfigured(
            "APP_BASE_PATH must be an absolute path containing only letters, "
            "digits, hyphens, underscores and slashes"
        )
    return value if value.endswith("/") else value + "/"
