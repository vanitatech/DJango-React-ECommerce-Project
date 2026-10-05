from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils.dateparse import parse_datetime
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APITestCase
from unittest.mock import patch

from .models import ContentBlock, ContentPage, PageContentBlock


class PublishedContentPageTests(APITestCase):
    def setUp(self):
        self.published_page = ContentPage.objects.create(
            title="About VanitaCart",
            slug="about",
            seo_description="Learn about our store.",
            is_published=True,
        )
        self.draft_page = ContentPage.objects.create(
            title="Draft policy",
            slug="draft-policy",
        )
        self.banner = ContentBlock.objects.create(
            name="Welcome banner",
            kind=ContentBlock.Kind.BANNER,
            heading="Thoughtful everyday essentials",
            body="<script>alert('not executable')</script>",
            button_label="Shop now",
            button_url="/",
        )
        self.inactive_block = ContentBlock.objects.create(
            name="Retired banner",
            kind=ContentBlock.Kind.TEXT,
            heading="Do not show",
            is_active=False,
        )
        PageContentBlock.objects.create(
            page=self.published_page,
            block=self.banner,
            position=1,
        )
        PageContentBlock.objects.create(
            page=self.published_page,
            block=self.inactive_block,
            position=0,
        )

    def test_page_directory_lists_only_published_pages(self):
        response = self.client.get(reverse("published_pages"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            [{"title": "About VanitaCart", "slug": "about"}],
        )

    def test_published_page_returns_active_sections_in_position_order(self):
        response = self.client.get(reverse("published_page", args=["about"]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "About VanitaCart")
        self.assertEqual(response.data["seo_description"], "Learn about our store.")
        self.assertEqual(
            [section["name"] for section in response.data["sections"]],
            ["Welcome banner"],
        )
        self.assertEqual(
            response.data["sections"][0]["body"],
            "<script>alert('not executable')</script>",
        )

    def test_draft_and_missing_pages_are_not_public(self):
        draft_response = self.client.get(
            reverse("published_page", args=["draft-policy"])
        )
        missing_response = self.client.get(
            reverse("published_page", args=["does-not-exist"])
        )

        self.assertEqual(draft_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)

    def test_content_block_can_be_reused_on_multiple_pages(self):
        second_page = ContentPage.objects.create(
            title="Contact",
            slug="contact",
            is_published=True,
        )
        PageContentBlock.objects.create(
            page=second_page,
            block=self.banner,
            position=0,
        )

        response = self.client.get(reverse("published_page", args=["contact"]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sections"][0]["id"], self.banner.id)
        self.assertEqual(self.banner.page_placements.count(), 2)

    def test_publishing_records_timestamp_and_unpublishing_clears_it(self):
        page = ContentPage.objects.create(title="New page", slug="new")
        self.assertIsNone(page.published_at)

        page.is_published = True
        page.save(update_fields=["is_published"])
        self.assertIsNotNone(page.published_at)

        page.is_published = False
        page.save(update_fields=["is_published"])
        self.assertIsNone(page.published_at)

    def test_future_scheduled_pages_are_hidden_until_their_publication_time(self):
        scheduled_at = timezone.now() + timedelta(days=1)
        scheduled_page = ContentPage.objects.create(
            title="Scheduled page",
            slug="scheduled-page",
            is_published=True,
            published_at=scheduled_at,
        )
        PageContentBlock.objects.create(
            page=scheduled_page,
            block=self.banner,
            position=0,
        )

        self.assertNotIn(
            {"title": "Scheduled page", "slug": "scheduled-page"},
            self.client.get(reverse("published_pages")).data,
        )
        self.assertEqual(
            self.client.get(
                reverse("published_page", args=["scheduled-page"])
            ).status_code,
            404,
        )

        with patch("django.utils.timezone.now", return_value=scheduled_at + timedelta(seconds=1)):
            published_list = self.client.get(reverse("published_pages"))
            published_page = self.client.get(
                reverse("published_page", args=["scheduled-page"])
            )

        self.assertIn(
            {"title": "Scheduled page", "slug": "scheduled-page"},
            published_list.data,
        )
        self.assertEqual(published_page.status_code, 200)
        self.assertEqual(published_page.data["publication_state"], "published")


class ContentPagePreviewTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="cms-staff",
            password="staff-password",
            is_staff=True,
        )
        self.customer = User.objects.create_user(
            username="cms-customer",
            password="customer-password",
        )
        self.page = ContentPage.objects.create(
            title="Preview only",
            slug="preview-only",
        )
        self.block = ContentBlock.objects.create(
            name="Draft page section",
            heading="Visible only in preview",
        )
        PageContentBlock.objects.create(
            page=self.page,
            block=self.block,
            position=0,
        )

    def test_draft_preview_is_staff_only_and_includes_page_sections(self):
        preview_url = reverse("preview_content_page", args=[self.page.slug])
        self.assertEqual(self.client.get(preview_url).status_code, 401)

        self.client.force_authenticate(user=self.customer)
        self.assertEqual(self.client.get(preview_url).status_code, 403)

        self.client.force_authenticate(user=self.staff_user)
        preview = self.client.get(preview_url)

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["publication_state"], "draft")
        self.assertEqual(
            preview.data["sections"][0]["heading"],
            "Visible only in preview",
        )
        self.assertEqual(
            self.client.get(
                reverse("published_page", args=[self.page.slug])
            ).status_code,
            404,
        )

    def test_scheduled_preview_shows_go_live_time(self):
        self.page.is_published = True
        self.page.published_at = timezone.now() + timedelta(days=1)
        self.page.save(update_fields=["is_published", "published_at"])
        self.client.force_authenticate(user=self.staff_user)

        preview = self.client.get(
            reverse("preview_content_page", args=[self.page.slug])
        )

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["publication_state"], "scheduled")
        self.assertEqual(
            parse_datetime(preview.data["published_at"]),
            self.page.published_at,
        )


class ContentBlockValidationTests(TestCase):
    def test_unsafe_content_links_are_rejected(self):
        block = ContentBlock(
            name="Unsafe link",
            button_label="Continue",
            button_url="javascript:alert(1)",
        )

        with self.assertRaises(ValidationError):
            block.full_clean()

    def test_protocol_relative_links_are_rejected(self):
        block = ContentBlock(
            name="External redirect",
            button_label="Continue",
            button_url="//example.com/path",
        )

        with self.assertRaises(ValidationError):
            block.full_clean()

    def test_image_blocks_require_a_secure_image_url(self):
        block = ContentBlock(
            name="Image block",
            kind=ContentBlock.Kind.IMAGE,
        )

        with self.assertRaises(ValidationError):
            block.full_clean()

    def test_internal_and_https_links_are_valid(self):
        for link in ("/pages/contact", "https://example.com/contact"):
            with self.subTest(link=link):
                block = ContentBlock(
                    name=f"Safe link {link}",
                    button_label="Continue",
                    button_url=link,
                )
                block.full_clean()
