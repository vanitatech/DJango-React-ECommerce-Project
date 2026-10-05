from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

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
