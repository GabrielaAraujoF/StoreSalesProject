from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)

from app.database.db import db
from app.models.account import Account

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth",
)


def account_to_dict(account):
    return {
        "id": account.id,
        "name": account.name,
        "email": account.email,
        "role": account.role,
        "active": account.active,
    }


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return {"error": "O corpo deve conter um JSON válido."}, 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not email.strip():
        return {"error": "O campo 'email' é obrigatório."}, 400

    if not isinstance(password, str) or not password:
        return {"error": "O campo 'password' é obrigatório."}, 400

    account = Account.query.filter_by(email=email.strip().lower()).first()

    if account is None or not account.check_password(password):
        return {"error": "E-mail ou senha inválidos."}, 401

    if not account.active:
        return {"error": "Conta inativa."}, 403

    token = create_access_token(identity=str(account.id))

    response = jsonify({
        "message": "Login realizado com sucesso.",
        "account": account_to_dict(account),
    })

    set_access_cookies(response, token)

    return response, 200


@auth_bp.get("/me")
@jwt_required()
def get_current_account():
    try:
        account_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return {"error": "Conta inválida."}, 401

    account = db.session.get(Account, account_id)

    if account is None:
        return {"error": "Conta inválida."}, 401

    if not account.active:
        return {"error": "Conta inativa."}, 403

    return {"account": account_to_dict(account)}


@auth_bp.post("/logout")
@jwt_required()
def logout():
    response = jsonify({
        "message": "Logout realizado com sucesso."
    })

    unset_jwt_cookies(response)

    return response, 200
