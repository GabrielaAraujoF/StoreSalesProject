from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from app.database.db import db
from app.models.seller import Seller

sellers_bp = Blueprint(
    "sellers",
    __name__,
    url_prefix="/api/sellers",
)

ALLOWED_FIELDS = {"name", "email", "active"}    # campos permitidos vir do front

def seller_to_dict(seller):
    return {
        "id": seller.id,
        "seller_number": seller.seller_number,
        "name": seller.name,
        "email" : seller.email,
        "active" : seller.active
    }

def validate_seller_data(data, required_fields=None):
    required_fields = required_fields or set()

    if not isinstance(data, dict):
        return None, (
            {"error": "O corpo deve conter um JSON válido."}, 
            400
            )
    
    unknown_fields = set(data) - ALLOWED_FIELDS
    if unknown_fields:
        fields = ", ".join(sorted(unknown_fields))
        return None, (
            {"error": f"Campos não permitidos: {fields}."},
            400,
        )

    missing_fields = required_fields - set(data)

    if missing_fields:
        fields = ", ".join(sorted(missing_fields))
        return None, (
            {"error": f"Campos obrigatórios ausentes: {fields}."},
            400,
        )

    if not data:
        return None, (
            {"error": "Informe pelo menos um campo para atualizar."},
            400,
        )

    validated_data = {}

    if "name" in data:
        name = data["name"]

        if not isinstance(name, str) or not name.strip():
            return None, (
                {"error": "O campo 'name' não pode ser vazio."},
                400,
            )

        name = name.strip()

        if len(name) > 100:
            return None, (
                {"error": "O campo 'name' deve ter no máximo 100 caracteres."},
                400,
            )

        validated_data["name"] = name

    if "email" in data:
        email = data["email"]

        if not isinstance(email, str) or not email.strip():
            return None, (
                {"error": "O campo 'email' não pode ser vazio."},
                400,
            )
        email = email.strip().lower()

        if len(email) > 100:
            return None, (
                {"error": "O campo 'email' deve ter no máximo 100 caracteres."},
                400,
            )

        validated_data["email"] = email

    if "active" in data:
        active = data["active"]

        if not isinstance(active, bool):
            return None, (
                {"error": "O campo 'active' deve ser booleano."},
                400,
            )

        validated_data["active"] = active

    return validated_data, None

def commit_or_error(message):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": message}, 409

    return None


@sellers_bp.post("/")
def create_seller():
    validated_data, error = validate_seller_data(
        request.get_json(silent=True),
        required_fields={"name", "email"},
    )

    if error:
        return error


# ativa o active
    validated_data.setdefault("active", True)

    last_seller_number = db.session.scalar(
        db.select(db.func.max(Seller.seller_number))
    )
    seller = Seller(
        seller_number=(last_seller_number or 0) + 1,
        **validated_data,
    )
    db.session.add(seller)

    error = commit_or_error(
        "Já existe um vendedor com este email"
    )

    if error:
        return error

    return seller_to_dict(seller), 201


@sellers_bp.get("/")
def list_sellers():
    sellers = Seller.query.order_by(Seller.id).all()
    return {"sellers": [
        seller_to_dict(seller)
        for seller in sellers
        ]
    }


@sellers_bp.get("/<int:seller_id>")
def get_seller(seller_id):
    seller = db.session.get(Seller, seller_id)

    if seller is None:
        return {"error": "Vendedor não encontrado."}, 404

    return seller_to_dict(seller)


@sellers_bp.patch("/<int:seller_id>")
def patch_seller(seller_id):
    seller = db.session.get(Seller, seller_id)

    if seller is None:
        return {"error": "Vendedor não encontrado."}, 404

    validated_data, error = validate_seller_data(
        request.get_json(silent=True),
    )

    if error:
        return error

    for field, value in validated_data.items():
        setattr(seller, field, value)

    error = commit_or_error(
        "Já existe um vendedor com este e-mail."
    )

    if error:
        return error

    return seller_to_dict(seller)

    


@sellers_bp.put("/<int:seller_id>")
def update_seller(seller_id):
    seller = db.session.get(Seller, seller_id)

    if seller is None:
        return {"error": "Vendedor não encontrado."}, 404

    validated_data, error = validate_seller_data(
        request.get_json(silent=True),
        required_fields={"name", "email", "active"},
    )
   
    if error:
        return error

    seller.name = validated_data["name"]
    seller.email = validated_data["email"]
    seller.active = validated_data["active"]

    error = commit_or_error(
        "Já existe um vendedor com este e-mail."
    )

    if error:
        return error

    return seller_to_dict(seller)

@sellers_bp.delete("/<int:seller_id>")
def delete_seller(seller_id):
    seller = db.session.get(Seller, seller_id)

    if seller is None:
        return {"error": "Vendedor não encontrado."}, 404

    db.session.delete(seller)

    error = commit_or_error(
        "Não é possível excluir um vendedor que possui vendas vinculadas."
    )

    if error:
        return error

    return "", 204
