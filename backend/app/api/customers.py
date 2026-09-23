from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from app.database.db import db
from app.models.customer import Customer

customers_bp = Blueprint(
    "customers",
    __name__,
    url_prefix="/api/customers",
)

def customer_to_dict(customer):
    return{
        "id":customer.id,
        "name": customer.name,
        "phone": customer.phone
    }

def validate_customer_data(data):
    if not isinstance(data, dict):
        return None, (
            {"error":"O corpo deve conter um JSON válido."},
            400,
        )

    name = data.get("name")
    phone = data.get("phone")

    if not isinstance(name, str) or not name.strip():
        return None, (
            {"error": "O campo 'name' é obrigatório."},
            400,
        )

    if len(name.strip()) > 100:
        return None, (
            {"error": "O campo 'name' deve ter no máximo 100 caracteres."},
            400,
        )

    if phone is not None and not isinstance(phone, str):
        return None,(
            {"error": "O campo 'phone' deve ser um texto."},
            400,
        )

    if phone is not None and len(phone.strip()) > 20:
        return None, (
            {"error": "O campo 'phone' deve ter no máximo 20 caracteres."},
            400,
        )
    return {
        "name": name.strip(),
        "phone": phone.strip() if phone else None,
    }, None


def phone_is_in_use(phone, *, ignored_customer_id=None):
    if phone is None:
        return False

    customer = Customer.query.filter_by(phone=phone).first()
    return customer is not None and customer.id != ignored_customer_id


def commit_customer_changes():
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "Já existe um cliente com este telefone."}, 409

    return None
@customers_bp.get("/")
def list_customers():
    customers = Customer.query.order_by(Customer.id).all()
    return {"customers": [customer_to_dict(customer) for customer in customers]}

@customers_bp.get("/by-phone")
def get_customer_by_phone():
    phone = request.args.get("phone", "").strip()

    if not phone:
        return {"error": "O parâmetro 'phone' é obrigatório."}, 400

    customer = Customer.query.filter_by(phone=phone).first()

    if customer is None:
        return {"error": "Cliente não encontrado."}, 404

    return customer_to_dict(customer)

@customers_bp.get("/<int:customer_id>")
def get_customer(customer_id):
    customer = db.session.get(Customer, customer_id)

    if customer is None:
        return {"error": "Cliente não encontrado."}, 404

    return customer_to_dict(customer)


@customers_bp.post("/")
def create_customer():
    validated_data, error = validate_customer_data(
        request.get_json(silent=True)
    )
    if error:
        return error

    if phone_is_in_use(validated_data["phone"]):
        return {"error": "Já existe um cliente com este telefone."}, 409

    customer = Customer(**validated_data)
    db.session.add(customer)

    error = commit_customer_changes()
    if error:
        return error

    return customer_to_dict(customer), 201


@customers_bp.put("/<int:customer_id>")
def update_customer(customer_id):
    customer = db.session.get(Customer, customer_id)

    if customer is None:
        return {"error": "Cliente não encontrado."}, 404

    validated_data, error = validate_customer_data(
        request.get_json(silent=True)
    )

    if error:
        return error

    if phone_is_in_use(
        validated_data["phone"],
        ignored_customer_id=customer.id,
    ):
        return {"error": "Já existe um cliente com este telefone."}, 409

    customer.name = validated_data["name"]
    customer.phone = validated_data["phone"]

    error = commit_customer_changes()
    if error:
        return error

    return customer_to_dict(customer)


@customers_bp.delete("/<int:customer_id>")
def delete_customer(customer_id):
    customer = db.session.get(Customer, customer_id)

    if customer is None:
        return {"error": "Cliente não encontrado."}, 404


    db.session.delete(customer)
    db.session.commit()

    return "", 204