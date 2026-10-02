from django.core.management.base import BaseCommand

from store.models import Category, Product


class Command(BaseCommand):
    help = 'Seed the storefront with demo products for portfolio demos.'

    def handle(self, *args, **options):
        categories = [
            ('Home Essentials', 'home-essentials'),
            ('Tech & Gadget', 'tech-gadget'),
            ('Lifestyle', 'lifestyle'),
        ]

        created_categories = {}
        for name, slug in categories:
            category, _ = Category.objects.get_or_create(name=name, slug=slug)
            created_categories[name] = category

        products = [
            {
                'category': created_categories['Home Essentials'],
                'name': 'Minimal Desk Lamp',
                'description': 'A warm ambient desk lamp designed to elevate focus and create a calming workspace.',
                'price': '42.99',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
            },
            {
                'category': created_categories['Tech & Gadget'],
                'name': 'Audio Pro Headphones',
                'description': 'Wireless over-ear headphones with crisp sound, deep bass, and all-day comfort.',
                'price': '129.00',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
            },
            {
                'category': created_categories['Lifestyle'],
                'name': 'Active Water Bottle',
                'description': 'Insulated stainless steel bottle built to keep drinks cold for hours and look good anywhere.',
                'price': '24.50',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80',
            },
            {
                'category': created_categories['Home Essentials'],
                'name': 'Cedar Storage Basket',
                'description': 'Textured, natural-fiber storage basket that brings organization and warmth to any room.',
                'price': '33.25',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
            },
            {
                'category': created_categories['Tech & Gadget'],
                'name': 'Smart Fitness Watch',
                'description': 'A sleek smartwatch for tracking activity, heart rate, and everyday productivity.',
                'price': '179.99',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
            },
            {
                'category': created_categories['Lifestyle'],
                'name': 'Travel Weekend Tote',
                'description': 'A durable carry-all tote that blends practicality with a minimalist, premium aesthetic.',
                'price': '58.00',
                'image': '',
                'external_image_url': 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',
            },
        ]

        for product_data in products:
            Product.objects.update_or_create(
                name=product_data['name'],
                defaults={
                    'category': product_data['category'],
                    'description': product_data['description'],
                    'price': product_data['price'],
                    'image': product_data['image'],
                    'external_image_url': product_data['external_image_url'],
                },
            )

        self.stdout.write(self.style.SUCCESS(f'Seeded {len(products)} demo products.'))
