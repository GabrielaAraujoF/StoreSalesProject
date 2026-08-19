from decimal import Decimal, InvalidOperation

from flask import Blueprint, request

from app.database.db import db
from app.models.product import Product


products_bp = Blueprint(
    "products",
    __name__,
    url_prefix="/api/products",
)


def product_to_dict(product):
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "price": str(product.price),
        "stock": product.stock,
    }


def validate_product_data(data, *, require_stock=False):
    if not isinstance(data, dict):
        return None, ({"error": "O corpo deve conter um JSON válido."}, 400)

    name = data.get("name")
    category = data.get("category")
    price_value = data.get("price")

    if not isinstance(name, str) or not name.strip():
        return None, ({"error": "O campo 'name' é obrigatório."}, 400)

    if len(name.strip()) > 100:
        return None, ({"error": "O campo 'name' deve ter no máximo 100 caracteres."}, 400)

    if not isinstance(category, str) or not category.strip():
        return None, ({"error": "O campo 'category' é obrigatório."}, 400)

    if len(category.strip()) > 100:
        return None, ({"error": "O campo 'category' deve ter no máximo 100 caracteres."}, 400)

    try:
        price = Decimal(str(price_value))
    except (InvalidOperation, TypeError, ValueError):
        return None, ({"error": "O campo 'price' deve ser um número válido."}, 400)

    if not price.is_finite() or price < 0:
        return None, ({"error": "O campo 'price' não pode ser negativo."}, 400)

    if require_stock and "stock" not in data:
        return None, ({"error": "O campo 'stock' é obrigatório."}, 400)

    stock = data.get("stock", 0)
    if isinstance(stock, bool) or not isinstance(stock, int) or stock < 0:
        return None, ({
            "error": "O campo 'stock' deve ser um número inteiro não negativo."
        }, 400)

    return {
        "name": name.strip(),
        "category": category.strip(),
        "price": price,
        "stock": stock,
    }, None


@products_bp.get("/")
def list_products():
    products = Product.query.order_by(Product.id).all()
    return {"products": [product_to_dict(product) for product in products]}


@products_bp.get("/<int:product_id>")
def get_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return {"error": "Produto não encontrado."}, 404

    return product_to_dict(product)


@products_bp.post("/")
def create_product():
    validated_data, error = validate_product_data(
        request.get_json(silent=True)
    )
    if error:
        return error

    product = Product(**validated_data)
    db.session.add(product)
    db.session.commit()

    return product_to_dict(product), 201


@products_bp.put("/<int:product_id>")
def update_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return {"error": "Produto não encontrado."}, 404

    validated_data, error = validate_product_data(
        request.get_json(silent=True),
        require_stock=True,
    )
    if error:
        return error

    product.name = validated_data["name"]
    product.category = validated_data["category"]
    product.price = validated_data["price"]
    product.stock = validated_data["stock"]
    db.session.commit()

    return product_to_dict(product)

@products_bp.patch("/<int:product_id>")
def patch_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return {"error": "Produto não encontrado."}, 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return {"error": "O corpo deve conter um JSON válido."}, 400

    allowed_fields = {"name", "category", "price", "stock"}
    fields_to_update = allowed_fields.intersection(data)

    if not fields_to_update:
        return {
            "error": "Informe ao menos um campo válido para atualização."
        }, 400

    merged_data =  {
        "name": product.name,
        "category": product.category,
        "price": product.price,
        "stock": product.stock,
    }

    for field in fields_to_update:
        merged_data[field] = data[field]

    validated_data, error = validate_product_data(
        merged_data,
        require_stock=True,
    )

    if error:
        return error

    for field in fields_to_update:
        setattr(product, field, validated_data[field])

    db.session.commit()

    return product_to_dict(product)


@products_bp.delete("/<int:product_id>")
def delete_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return {"error": "Produto não encontrado."}, 404

    if product.sale_items:
        return {
            "error": "Produto não pode ser excluído porque possui vendas associadas."
        }, 409

    db.session.delete(product)
    db.session.commit()

    return "", 204