from decimal import Decimal

from django.utils import timezone
from django.db.models import Count, Sum

from .models import Order, Product


def get_operations_summary(user):
    today = timezone.localdate()
    can_view_orders = user.has_perm("store.view_order")
    can_view_products = user.has_perm("store.view_product")
    summary = {
        "can_view_orders": can_view_orders,
        "can_view_products": can_view_products,
        "date": today.isoformat(),
    }

    if can_view_orders:
        status_counts = {
            entry["status"]: entry["count"]
            for entry in Order.objects.values("status").annotate(count=Count("id"))
        }
        paid_revenue = (
            Order.objects.filter(
                payment_status=Order.PaymentStatus.PAID,
                created_at__date=today,
            ).aggregate(total=Sum("total_amount"))["total"]
            or Decimal("0.00")
        )
        summary.update(
            today_orders=Order.objects.filter(created_at__date=today).count(),
            paid_revenue_today=format(paid_revenue, ".2f"),
            status_counts=[
                {
                    "value": value,
                    "label": label,
                    "count": status_counts.get(value, 0),
                }
                for value, label in Order.Status.choices
            ],
        )

    if can_view_products:
        low_stock_products = (
            Product.objects.filter(stock_quantity__lte=5)
            .select_related("category")
            .order_by("stock_quantity", "name")
        )
        summary.update(
            low_stock_threshold=5,
            low_stock_products=[
                {
                    "id": product.pk,
                    "name": product.name,
                    "category": product.category.name,
                    "stock_quantity": product.stock_quantity,
                }
                for product in low_stock_products
            ],
        )

    return summary
