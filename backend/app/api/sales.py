from datetime import UTC, date, datetime, time, timedelta, timezone
from decimal import Decimal
from math import ceil
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, request
from sqlalchemy import String, cast, func, or_, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload

from app.database.db import db
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.seller import Seller


sales_bp = Blueprint(
    "sales",
    __name__,
    url_prefix="/api/sales",
)

try:
    BRAZIL_TIMEZONE = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    # Windows installations may not include the IANA database. Brazil has used
    # UTC-03:00 year-round since 2019, which covers the application's records.
    BRAZIL_TIMEZONE = timezone(timedelta(hours=-3), name="America/Sao_Paulo")
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100
PAYMENT_METHOD_ALIASES = {
    "card": "credit_card",
}


def normalize_payment_method(value):
    return PAYMENT_METHOD_ALIASES.get(value, value)


def stored_payment_methods(value):
    normalized_value = normalize_payment_method(value)
    aliases = [
        alias
        for alias, canonical in PAYMENT_METHOD_ALIASES.items()
        if canonical == normalized_value
    ]
    return (normalized_value, *aliases)


def utc_isoformat(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)

    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_positive_integer(name, default, maximum=None):
    raw_value = request.args.get(name)
    if raw_value is None:
        return default, None

    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return None, ({"error": f"O parâmetro '{name}' deve ser um inteiro positivo."}, 400)

    if value <= 0 or (maximum is not None and value > maximum):
        limit_message = f" de até {maximum}" if maximum is not None else ""
        return None, ({
            "error": f"O parâmetro '{name}' deve ser um inteiro positivo{limit_message}."
        }, 400)

    return value, None


def parse_local_date(name):
    raw_value = request.args.get(name)
    if raw_value is None or not raw_value.strip():
        return None, None

    try:
        return date.fromisoformat(raw_value), None
    except ValueError:
        return None, ({
            "error": f"O parâmetro '{name}' deve usar o formato AAAA-MM-DD."
        }, 400)


def local_midnight_as_utc(value):
    local_value = datetime.combine(value, time.min, tzinfo=BRAZIL_TIMEZONE)
    return local_value.astimezone(UTC).replace(tzinfo=None)


def sale_to_dict(sale):
    return {
        "id": sale.id,
        "customer": (
            {
                "id": sale.customer.id,
                "name": sale.customer.name,
                "phone": sale.customer.phone,
            }
            if sale.customer is not None
            else None
        ),
        "seller": (
            {
                "id": sale.seller.id,
                "seller_number": sale.seller.seller_number,
                "name": sale.seller.name,
            }
            if sale.seller is not None
            else None
        ),
        "payment_method": normalize_payment_method(sale.payment_method),
        "total": str(sale.total),
        "created_at": utc_isoformat(sale.created_at),
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "subtotal": str(item.subtotal),
            }
            for item in sale.items
        ],
    }


def validate_sale_data(data):
    if not isinstance(data, dict):
        return None, ({"error": "O corpo deve conter um JSON válido."}, 400)

    customer_id = data.get("customer_id")
    if customer_id is not None and (
        isinstance(customer_id, bool)
        or not isinstance(customer_id, int)
        or customer_id <= 0
    ):
        return None, ({
            "error": "O campo 'customer_id' deve ser um inteiro positivo ou null."
        }, 400)

    seller_id = data.get("seller_id")
    if (
        isinstance(seller_id, bool)
        or not isinstance(seller_id, int)
        or seller_id <= 0
    ):
        return None, ({
            "error": "O campo 'seller_id' deve ser um inteiro positivo."
        }, 400)

    payment_method = data.get("payment_method")
    if not isinstance(payment_method, str) or not payment_method.strip():
        return None, ({"error": "O campo 'payment_method' é obrigatório."}, 400)

    payment_method = normalize_payment_method(payment_method.strip())
    if len(payment_method) > 30:
        return None, ({
            "error": "O campo 'payment_method' deve ter no máximo 30 caracteres."
        }, 400)

    items = data.get("items")
    if not isinstance(items, list) or not items:
        return None, ({"error": "A venda deve conter pelo menos um item."}, 400)

    validated_items = []
    product_ids = set()

    for position, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            return None, ({"error": f"O item {position} deve ser um objeto."}, 400)

        product_id = item.get("product_id")
        quantity = item.get("quantity")

        if (
            isinstance(product_id, bool)
            or not isinstance(product_id, int)
            or product_id <= 0
        ):
            return None, ({
                "error": f"O product_id do item {position} deve ser um inteiro positivo."
            }, 400)

        if (
            isinstance(quantity, bool)
            or not isinstance(quantity, int)
            or quantity <= 0
        ):
            return None, ({
                "error": f"A quantity do item {position} deve ser um inteiro positivo."
            }, 400)

        if product_id in product_ids:
            return None, ({
                "error": f"O produto {product_id} aparece mais de uma vez na venda."
            }, 400)

        product_ids.add(product_id)
        validated_items.append({
            "product_id": product_id,
            "quantity": quantity,
        })

    return {
        "customer_id": customer_id,
        "seller_id": seller_id,
        "payment_method": payment_method,
        "items": validated_items,
    }, None


@sales_bp.get("/")
def list_sales():
    paginate_results = "page" in request.args or "per_page" in request.args
    page, error = parse_positive_integer("page", 1)
    if error:
        return error

    per_page, error = parse_positive_integer(
        "per_page",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
    )
    if error:
        return error

    date_from, error = parse_local_date("date_from")
    if error:
        return error

    date_to, error = parse_local_date("date_to")
    if error:
        return error

    if date_from is not None and date_to is not None and date_from > date_to:
        return {"error": "A data inicial não pode ser posterior à data final."}, 400

    seller_id = request.args.get("seller_id")
    if seller_id is not None:
        try:
            seller_id = int(seller_id)
        except (TypeError, ValueError):
            return {"error": "O parâmetro 'seller_id' deve ser um inteiro positivo."}, 400

        if seller_id <= 0:
            return {"error": "O parâmetro 'seller_id' deve ser um inteiro positivo."}, 400

    seller_search = request.args.get("seller", "").strip()
    if len(seller_search) > 100:
        return {"error": "O parâmetro 'seller' deve ter no máximo 100 caracteres."}, 400

    payment_method = request.args.get("payment_method", "").strip()
    if len(payment_method) > 30:
        return {
            "error": "O parâmetro 'payment_method' deve ter no máximo 30 caracteres."
        }, 400

    query = Sale.query

    if date_from is not None:
        query = query.filter(Sale.created_at >= local_midnight_as_utc(date_from))

    if date_to is not None:
        exclusive_end = local_midnight_as_utc(date_to + timedelta(days=1))
        query = query.filter(Sale.created_at < exclusive_end)

    if seller_id is not None:
        query = query.filter(Sale.seller_id == seller_id)
    elif seller_search:
        query = query.join(Seller, Sale.seller_id == Seller.id).filter(
            or_(
                Seller.name.icontains(seller_search, autoescape=True),
                cast(Seller.seller_number, String).contains(
                    seller_search,
                    autoescape=True,
                ),
            )
        )

    if payment_method:
        query = query.filter(
            Sale.payment_method.in_(stored_payment_methods(payment_method))
        )

    total_count, total_amount = query.with_entities(
        func.count(Sale.id),
        func.coalesce(func.sum(Sale.total), Decimal("0.00")),
    ).one()

    ordered_query = (
        query
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.seller),
            selectinload(Sale.items).selectinload(SaleItem.product),
        )
        .order_by(Sale.created_at.desc(), Sale.id.desc())
    )

    if paginate_results:
        sales = (
            ordered_query
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        response_per_page = per_page
        total_pages = ceil(total_count / per_page) if total_count else 0
    else:
        sales = ordered_query.all()
        response_per_page = total_count
        total_pages = 1 if total_count else 0

    return {
        "sales": [sale_to_dict(sale) for sale in sales],
        "pagination": {
            "page": page,
            "per_page": response_per_page,
            "total": total_count,
            "total_pages": total_pages,
        },
        "summary": {
            "sales_count": total_count,
            "total_amount": str(total_amount),
        },
    }


@sales_bp.get("/filter-sellers")
def list_sale_filter_sellers():
    sellers = Seller.query.order_by(Seller.seller_number).all()
    return {
        "sellers": [
            {
                "id": seller.id,
                "seller_number": seller.seller_number,
                "name": seller.name,
                "active": seller.active,
            }
            for seller in sellers
        ]
    }


@sales_bp.get("/<int:sale_id>")
def get_sale(sale_id):
    sale = db.session.get(Sale, sale_id)

    if sale is None:
        return {"error": "Venda não encontrada."}, 404

    return sale_to_dict(sale)


@sales_bp.post("/")
def create_sale():
    validated_data, error = validate_sale_data(
        request.get_json(silent=True)
    )
    if error:
        return error

    customer = None
    customer_id = validated_data["customer_id"]
    if customer_id is not None:
        customer = db.session.get(Customer, customer_id)
        if customer is None:
            return {"error": "Cliente não encontrado."}, 404

    seller = db.session.get(Seller, validated_data["seller_id"])
    if seller is None:
        return {"error": "Vendedor não encontrado."}, 404

    if not seller.active:
        return {"error": "Vendedor inativo."}, 409

    sale = Sale(
        customer=customer,
        seller=seller,
        payment_method=validated_data["payment_method"],
        total=Decimal("0.00"),
    )

    db.session.add(sale)
    total = Decimal("0.00")

    for item_data in validated_data["items"]:
        product = db.session.get(Product, item_data["product_id"])
        if product is None:
            db.session.rollback()
            return {
                "error": f"Produto {item_data['product_id']} não encontrado."
            }, 404

        quantity = item_data["quantity"]
        stock_update = db.session.execute(
            update(Product)
            .where(
                Product.id == product.id,
                Product.stock >= quantity,
            )
            .values(stock=Product.stock - quantity)
            .execution_options(synchronize_session=False)
        )

        if stock_update.rowcount != 1:
            db.session.rollback()
            current_product = db.session.get(Product, product.id)
            available_stock = current_product.stock or 0
            return {
                "error": f"Estoque insuficiente para o produto {product.id}.",
                "available_stock": available_stock,
            }, 409

        unit_price = product.price
        subtotal = unit_price * quantity
        total += subtotal

        sale.items.append(SaleItem(
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        ))

    sale.total = total

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return {"error": "Não foi possível concluir a venda."}, 500

    return sale_to_dict(sale), 201
