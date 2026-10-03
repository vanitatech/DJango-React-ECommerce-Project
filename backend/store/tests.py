from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import (
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    Product,
    ProductImage,
    Review,
    UserProfile,
    WishlistItem,
)


class StoreFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="shopper", password="strong-test-password")
        self.other_user = User.objects.create_user(
            username="another-shopper", password="strong-test-password"
        )
        self.category = Category.objects.create(name="Accessories", slug="accessories")
        self.product = Product.objects.create(
            category=self.category,
            name="Canvas Bag",
            description="Everyday carry bag",
            price="25.00",
            stock_quantity=4,
        )
        self.client.force_authenticate(user=self.user)

    def test_checkout_creates_order_snapshot_and_decrements_inventory(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)

        response = self.client.post(
            reverse("create_order"),
            {
                "name": "Shopper Name",
                "address": "10 Market Street",
                "phone": "0123456789",
                "payment_method": "COD",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(pk=response.data["order_id"])
        item = order.items.get()
        self.product.refresh_from_db()
        self.assertEqual(order.customer_name, "Shopper Name")
        self.assertEqual(order.shipping_address, "10 Market Street")
        self.assertEqual(order.status, Order.Status.PROCESSING)
        self.assertEqual(item.product_name, "Canvas Bag")
        self.assertEqual(item.price, self.product.price)
        self.assertEqual(self.product.stock_quantity, 2)
        self.assertFalse(cart.items.exists())

    def test_checkout_rejects_insufficient_stock_without_partial_order(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=5)

        response = self.client.post(
            reverse("create_order"),
            {
                "name": "Shopper Name",
                "address": "10 Market Street",
                "phone": "0123456789",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 4)
        self.assertTrue(cart.items.exists())

    def test_cart_cannot_exceed_available_stock(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=4)

        response = self.client.post(
            reverse("cart_add"),
            {"product_id": self.product.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(cart.items.get().quantity, 4)

    def test_cart_add_accepts_quantity_and_accumulates_items(self):
        url = reverse("cart_add")

        first_response = self.client.post(
            url,
            {"product_id": self.product.id, "quantity": 2},
            format="json",
        )
        second_response = self.client.post(
            url,
            {"product_id": self.product.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(CartItem.objects.get(product=self.product).quantity, 3)

    def test_cart_add_rejects_invalid_quantity_without_creating_item(self):
        for quantity in (0, -1, "many", 1.5):
            with self.subTest(quantity=quantity):
                response = self.client.post(
                    reverse("cart_add"),
                    {"product_id": self.product.id, "quantity": quantity},
                    format="json",
                )

                self.assertEqual(response.status_code, 400)
                self.assertFalse(CartItem.objects.filter(product=self.product).exists())

    def test_cart_add_rejects_quantity_over_stock_without_partial_update(self):
        cart = Cart.objects.create(user=self.user)
        item = CartItem.objects.create(cart=cart, product=self.product, quantity=3)

        response = self.client.post(
            reverse("cart_add"),
            {"product_id": self.product.id, "quantity": 2},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 3)

    def test_cart_quantity_update_rejects_stock_overflow_without_changing_quantity(self):
        cart = Cart.objects.create(user=self.user)
        item = CartItem.objects.create(cart=cart, product=self.product, quantity=2)

        response = self.client.post(
            "/api/cart/update/",
            {"item_id": item.id, "quantity": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only 4 units", response.data["error"])
        item.refresh_from_db()
        self.assertEqual(item.quantity, 2)

    def test_order_history_only_returns_current_users_orders(self):
        own_order = Order.objects.create(
            user=self.user,
            total_amount="25.00",
            customer_name="Shopper Name",
            shipping_address="10 Market Street",
        )
        OrderItem.objects.create(
            order=own_order,
            product=self.product,
            product_name=self.product.name,
            quantity=1,
            price=self.product.price,
        )
        Order.objects.create(user=self.other_user, total_amount="99.00")

        response = self.client.get(reverse("get_orders"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], own_order.id)
        self.assertEqual(response.data[0]["items"][0]["product_name"], "Canvas Bag")

    def test_product_review_is_public_to_read_and_limited_to_one_per_user(self):
        create_response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 5, "comment": "Excellent quality"},
            format="json",
        )
        duplicate_response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 4, "comment": "Another review"},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(duplicate_response.status_code, 409)
        self.assertTrue(create_response.data["is_owner"])
        self.assertEqual(Review.objects.filter(product=self.product, user=self.user).count(), 1)

        self.client.force_authenticate(user=None)
        list_response = self.client.get(reverse("product_reviews", args=[self.product.id]))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data[0]["username"], self.user.username)
        self.assertFalse(list_response.data[0]["is_owner"])

        product_response = self.client.get(reverse("product_detail", args=[self.product.id]))
        self.assertEqual(product_response.data["review_count"], 1)
        self.assertEqual(product_response.data["average_rating"], 5.0)

    def test_customer_can_edit_own_product_review(self):
        review = Review.objects.create(
            user=self.user,
            product=self.product,
            rating=2,
            comment="Could be better",
        )

        response = self.client.patch(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 5, "comment": "Much better than expected"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], review.id)
        self.assertTrue(response.data["is_owner"])
        self.assertEqual(response.data["rating"], 5)
        self.assertEqual(response.data["comment"], "Much better than expected")
        review.refresh_from_db()
        self.assertEqual(review.rating, 5)
        self.assertEqual(review.comment, "Much better than expected")

    def test_customer_cannot_edit_another_users_product_review(self):
        review = Review.objects.create(
            user=self.other_user,
            product=self.product,
            rating=3,
            comment="Other customer's review",
        )

        response = self.client.patch(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 1, "comment": "Changed by another user"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        review.refresh_from_db()
        self.assertEqual(review.rating, 3)
        self.assertEqual(review.comment, "Other customer's review")

    def test_editing_product_review_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(Review.objects.exists())

    def test_product_review_rejects_out_of_range_rating(self):
        response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 6, "comment": "Invalid rating"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Review.objects.count(), 0)

    def test_product_api_includes_ordered_additional_images(self):
        second_image = ProductImage.objects.create(
            product=self.product,
            image_url="https://example.com/second-view.jpg",
            alt_text="Side view",
            position=1,
        )
        first_image = ProductImage.objects.create(
            product=self.product,
            image_url="https://example.com/first-detail.jpg",
            alt_text="Detail view",
            position=0,
        )

        response = self.client.get(reverse("product_detail", args=[self.product.id]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [image["id"] for image in response.data["images"]],
            [first_image.id, second_image.id],
        )
        self.assertEqual(response.data["images"][0]["alt_text"], "Detail view")

    def test_anonymous_customer_cannot_submit_review(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            reverse("product_reviews", args=[self.product.id]),
            {"rating": 5, "comment": "Unauthenticated review"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(Review.objects.count(), 0)

    def test_profile_can_be_retrieved_and_updated(self):
        get_response = self.client.get(reverse("user_profile"))
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data["username"], "shopper")

        update_response = self.client.put(
            reverse("user_profile"),
            {
                "email": "shopper@example.com",
                "phone": "0123456789",
                "address": "10 Market Street",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data["email"], "shopper@example.com")
        self.assertEqual(update_response.data["phone"], "0123456789")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "shopper@example.com")
        self.assertEqual(UserProfile.objects.get(user=self.user).address, "10 Market Street")

    def test_profile_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse("user_profile"))

        self.assertEqual(response.status_code, 401)
        self.assertFalse(UserProfile.objects.exists())

    def test_order_cancellation_restores_stock_and_is_idempotently_blocked(self):
        self.product.stock_quantity = 2
        self.product.save(update_fields=["stock_quantity"])
        order = Order.objects.create(
            user=self.user,
            total_amount="50.00",
            customer_name="Shopper Name",
            shipping_address="10 Market Street",
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            quantity=2,
            price=self.product.price,
        )

        response = self.client.post(reverse("cancel_order", args=[order.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 4)

        repeated_response = self.client.post(reverse("cancel_order", args=[order.id]))
        self.assertEqual(repeated_response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 4)

    def test_order_cancellation_cannot_access_another_users_order(self):
        order = Order.objects.create(
            user=self.other_user,
            total_amount="25.00",
            status=Order.Status.PROCESSING,
        )

        response = self.client.post(reverse("cancel_order", args=[order.id]))

        self.assertEqual(response.status_code, 404)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PROCESSING)

    def test_only_processing_orders_can_be_cancelled(self):
        order = Order.objects.create(
            user=self.user,
            total_amount="25.00",
            status=Order.Status.SHIPPED,
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            quantity=1,
            price=self.product.price,
        )

        response = self.client.post(reverse("cancel_order", args=[order.id]))

        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 4)

    def test_wishlist_is_private_and_returns_saved_products(self):
        own_saved = Product.objects.create(
            category=self.category,
            name="Saved product",
            price="12.00",
        )
        other_saved = Product.objects.create(
            category=self.category,
            name="Private product",
            price="13.00",
        )
        WishlistItem.objects.create(user=self.user, product=own_saved)
        WishlistItem.objects.create(user=self.other_user, product=other_saved)

        response = self.client.get(reverse("get_wishlist"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [own_saved.id])

    def test_wishlist_add_is_idempotent_and_can_be_removed(self):
        add_url = reverse("update_wishlist", args=[self.product.id])

        first_add = self.client.post(add_url)
        repeated_add = self.client.post(add_url)
        self.assertEqual(first_add.status_code, 201)
        self.assertEqual(repeated_add.status_code, 200)
        self.assertEqual(WishlistItem.objects.filter(user=self.user, product=self.product).count(), 1)

        remove_response = self.client.delete(add_url)
        self.assertEqual(remove_response.status_code, 204)
        self.assertFalse(WishlistItem.objects.filter(user=self.user, product=self.product).exists())

    def test_wishlist_rejects_unknown_products_and_requires_authentication(self):
        missing_product = self.client.post(reverse("update_wishlist", args=[99999]))
        self.assertEqual(missing_product.status_code, 404)

        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("get_wishlist"))
        self.assertEqual(response.status_code, 401)
