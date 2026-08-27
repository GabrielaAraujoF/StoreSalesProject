from decimal import Decimal

from flask import Blueprint, request
from sqlalchemy import update
from sqlalchemy.exc import SQLAlchemyError

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
        "payment_method": sale.payment_method,
        "total": str(sale.total),
        "created_at": sale.created_at.isoformat(),
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

    payment_method = payment_method.strip()
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
    sales = Sale.query.order_by(Sale.created_at.desc(), Sale.id.desc()).all()
    return {"sales": [sale_to_dict(sale) for sale in sales]}


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
