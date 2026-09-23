from functools import wraps

from flask import jsonify
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt_identity
)

from app.database.db import db
from app.models.account import Account


def admin_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()

        try:
            account_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({
                "error": "Conta inválida."
            }), 401

        account = db.session.get(
            Account,
            account_id,
        )

        if account is None:
            return jsonify({
                "error": "Conta inválida."
            }), 401

        if not account.active:
            return jsonify({
                "error": "Conta inativa."
            }), 403

        if account.role != "admin":
            return jsonify({
                "error": "Acesso não autorizado."
            }), 403

        return function(*args, **kwargs)

    return wrapper
