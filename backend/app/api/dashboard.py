from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, request
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import selectinload

from app.api.sales import (
    BRAZIL_TIMEZONE,
    local_midnight_as_utc,
    normalize_payment_method,
    parse_local_date,
    sale_to_dict,
)
from app.database.db import db
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.seller import Seller


dashboard_bp = Blueprint(
    "dashboard",
    __name__,
    url_prefix="/api/dashboard",
)

PAYMENT_METHODS = (
    ("cash", "Dinheiro"),
    ("credit_card", "Cartão de crédito"),
    ("debit_card", "Cartão de débito"),
    ("pix", "Pix"),
)
MONTH_LABELS = (
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
)


def brazil_today():
    return datetime.now(UTC).astimezone(BRAZIL_TIMEZONE).date()


def as_brazil_datetime(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(BRAZIL_TIMEZONE)


def parse_seller_filter():
    seller_id = request.args.get("seller_id")
    if seller_id is not None:
        try:
            seller_id = int(seller_id)
        except (TypeError, ValueError):
            return None, None, ({
                "error": "O parâmetro 'seller_id' deve ser um inteiro positivo."
            }, 400)

        if seller_id <= 0:
            return None, None, ({
                "error": "O parâmetro 'seller_id' deve ser um inteiro positivo."
            }, 400)

    seller_search = request.args.get("seller", "").strip()
    if len(seller_search) > 100:
        return None, None, ({
            "error": "O parâmetro 'seller' deve ter no máximo 100 caracteres."
        }, 400)

    return seller_id, seller_search, None


def sale_conditions(date_from, date_to, seller_id, seller_search):
    conditions = [
        Sale.created_at >= local_midnight_as_utc(date_from),
        Sale.created_at < local_midnight_as_utc(date_to + timedelta(days=1)),
    ]

    if seller_id is not None:
        conditions.append(Sale.seller_id == seller_id)
    elif seller_search:
        matching_sellers = db.select(Seller.id).where(
            or_(
                Seller.name.icontains(seller_search, autoescape=True),
                cast(Seller.seller_number, String).contains(
                    seller_search,
                    autoescape=True,
                ),
            )
        )
        conditions.append(Sale.seller_id.in_(matching_sellers))

    return conditions


def create_evolution(date_from, date_to, sales):
    day_count = (date_to - date_from).days + 1

    if day_count == 1:
        grouping = "hour"
        buckets = [
            {
                "key": f"{date_from.isoformat()}T{hour:02d}:00",
                "label": f"{hour:02d}h",
                "total": Decimal("0.00"),
            }
            for hour in range(24)
        ]
        positions = {bucket["key"]: bucket for bucket in buckets}
        for created_at, total in sales:
            local_value = as_brazil_datetime(created_at)
            key = f"{local_value.date().isoformat()}T{local_value.hour:02d}:00"
            positions[key]["total"] += total
    elif day_count <= 62:
        grouping = "day"
        buckets = []
        current_date = date_from
        while current_date <= date_to:
            buckets.append({
                "key": current_date.isoformat(),
                "label": current_date.strftime("%d/%m"),
                "total": Decimal("0.00"),
            })
            current_date += timedelta(days=1)

        positions = {bucket["key"]: bucket for bucket in buckets}
        for created_at, total in sales:
            key = as_brazil_datetime(created_at).date().isoformat()
            positions[key]["total"] += total
    else:
        grouping = "month"
        buckets = []
        current_month = date(date_from.year, date_from.month, 1)
        end_month = date(date_to.year, date_to.month, 1)
        while current_month <= end_month:
            buckets.append({
                "key": current_month.strftime("%Y-%m"),
                "label": f"{MONTH_LABELS[current_month.month - 1]}/{current_month.year}",
                "total": Decimal("0.00"),
            })
            if current_month.month == 12:
                current_month = date(current_month.year + 1, 1, 1)
            else:
                current_month = date(current_month.year, current_month.month + 1, 1)

        positions = {bucket["key"]: bucket for bucket in buckets}
        for created_at, total in sales:
            key = as_brazil_datetime(created_at).strftime("%Y-%m")
            positions[key]["total"] += total

    return {
        "grouping": grouping,
        "points": [
            {
                "key": bucket["key"],
                "label": bucket["label"],
                "total": str(bucket["total"]),
            }
            for bucket in buckets
        ],
    }


@dashboard_bp.get("/")
def get_dashboard():
    today = brazil_today()
    default_date_from = today.replace(day=1)

    date_from, error = parse_local_date("date_from")
    if error:
        return error
    date_to, error = parse_local_date("date_to")
    if error:
        return error

    date_from = date_from or default_date_from
    date_to = date_to or today
    if date_from > date_to:
        return {"error": "A data inicial não pode ser posterior à data final."}, 400

    seller_id, seller_search, error = parse_seller_filter()
    if error:
        return error

    conditions = sale_conditions(
        date_from,
        date_to,
        seller_id,
        seller_search,
    )

    sales_count, total_amount = (
        db.session.query(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total), Decimal("0.00")),
        )
        .select_from(Sale)
        .filter(*conditions)
        .one()
    )
    units_sold = (
        db.session.query(func.coalesce(func.sum(SaleItem.quantity), 0))
        .select_from(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(*conditions)
        .scalar()
    )
    average_ticket = (
        (total_amount / sales_count).quantize(Decimal("0.01"))
        if sales_count
        else Decimal("0.00")
    )

    payment_rows = (
        db.session.query(
            Sale.payment_method,
            func.count(Sale.id),
            func.sum(Sale.total),
        )
        .filter(*conditions)
        .group_by(Sale.payment_method)
        .all()
    )
    payment_values = {}
    for method, count, amount in payment_rows:
        normalized_method = normalize_payment_method(method)
        previous_count, previous_amount = payment_values.get(
            normalized_method,
            (0, Decimal("0.00")),
        )
        payment_values[normalized_method] = (
            previous_count + count,
            previous_amount + amount,
        )
    payments = []
    for method, label in PAYMENT_METHODS:
        count, amount = payment_values.get(method, (0, Decimal("0.00")))
        percentage = (
            round(float((amount / total_amount) * 100), 1)
            if total_amount
            else 0.0
        )
        payments.append({
            "method": method,
            "label": label,
            "sales_count": count,
            "total": str(amount),
            "percentage": percentage,
        })

    product_rows = (
        db.session.query(
            Product.id,
            Product.name,
            func.sum(SaleItem.quantity).label("units"),
            func.sum(SaleItem.subtotal).label("total"),
        )
        .select_from(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .filter(*conditions)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc(), func.sum(SaleItem.subtotal).desc())
        .limit(5)
        .all()
    )

    seller_rows = (
        db.session.query(
            Seller.id,
            Seller.seller_number,
            Seller.name,
            Seller.active,
            func.count(Sale.id).label("sales_count"),
            func.sum(Sale.total).label("total"),
        )
        .select_from(Seller)
        .join(Sale, Sale.seller_id == Seller.id)
        .filter(*conditions)
        .group_by(
            Seller.id,
            Seller.seller_number,
            Seller.name,
            Seller.active,
        )
        .order_by(func.sum(Sale.total).desc(), func.count(Sale.id).desc())
        .all()
    )

    evolution_sales = (
        db.session.query(Sale.created_at, Sale.total)
        .filter(*conditions)
        .order_by(Sale.created_at)
        .all()
    )
    recent_sales = (
        Sale.query
        .filter(*conditions)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.seller),
            selectinload(Sale.items).selectinload(SaleItem.product),
        )
        .order_by(Sale.created_at.desc(), Sale.id.desc())
        .limit(5)
        .all()
    )

    return {
        "period": {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        },
        "summary": {
            "total_amount": str(total_amount),
            "sales_count": sales_count,
            "average_ticket": str(average_ticket),
            "units_sold": units_sold,
        },
        "evolution": create_evolution(date_from, date_to, evolution_sales),
        "payments": payments,
        "top_products": [
            {
                "product_id": product_id,
                "name": name,
                "units_sold": units,
                "total_amount": str(total),
            }
            for product_id, name, units, total in product_rows
        ],
        "seller_performance": [
            {
                "seller_id": seller_id,
                "seller_number": seller_number,
                "name": name,
                "active": active,
                "sales_count": count,
                "total_amount": str(total),
            }
            for seller_id, seller_number, name, active, count, total in seller_rows
        ],
        "recent_sales": [sale_to_dict(sale) for sale in recent_sales],
    }
