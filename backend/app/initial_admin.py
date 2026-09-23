import re

from app.database.db import db
from app.models.account import Account


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MINIMUM_PASSWORD_LENGTH = 8


class InitialAdminError(ValueError):
    """Raised when the initial administrator configuration is invalid."""


def get_or_create_initial_admin(name, email, password):
    """Add the configured administrator to the session if it does not exist."""
    name = (name or "").strip()
    email = (email or "").strip().lower()

    missing_variables = [
        variable
        for variable, value in (
            ("INITIAL_ADMIN_NAME", name),
            ("INITIAL_ADMIN_EMAIL", email),
            ("INITIAL_ADMIN_PASSWORD", password),
        )
        if not value
    ]

    if missing_variables:
        raise InitialAdminError(
            "Defina as variáveis de ambiente: " + ", ".join(missing_variables) + "."
        )

    if len(name) > 100:
        raise InitialAdminError("O nome deve ter no máximo 100 caracteres.")

    if len(email) > 100 or not EMAIL_PATTERN.fullmatch(email):
        raise InitialAdminError(
            "Informe um e-mail válido com até 100 caracteres."
        )

    if len(password) < MINIMUM_PASSWORD_LENGTH:
        raise InitialAdminError(
            f"A senha deve ter pelo menos {MINIMUM_PASSWORD_LENGTH} caracteres."
        )

    account = Account.query.filter_by(email=email).first()

    if account is not None:
        if account.role != "admin":
            raise InitialAdminError(
                "Já existe uma conta não administrativa com o e-mail configurado."
            )

        return account, False

    account = Account(
        name=name,
        email=email,
        role="admin",
        active=True,
    )
    account.set_password(password)
    db.session.add(account)
    return account, True
