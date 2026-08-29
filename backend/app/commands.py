import re

import click
from flask.cli import with_appcontext
from sqlalchemy.exc import IntegrityError

from app.database.db import db
from app.models.account import Account


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MINIMUM_PASSWORD_LENGTH = 8


@click.command("create-admin")
@click.option("--name", prompt="Nome", help="Nome do administrador.")
@click.option("--email", prompt="E-mail", help="E-mail usado no login.")
@with_appcontext
def create_admin_command(name, email):
    """Cria uma conta administrativa com senha armazenada como hash."""
    name = name.strip()
    email = email.strip().lower()

    if not name:
        raise click.ClickException("O nome é obrigatório.")

    if len(name) > 100:
        raise click.ClickException("O nome deve ter no máximo 100 caracteres.")

    if len(email) > 100 or not EMAIL_PATTERN.fullmatch(email):
        raise click.ClickException("Informe um e-mail válido com até 100 caracteres.")

    if Account.query.filter_by(email=email).first() is not None:
        raise click.ClickException("Já existe uma conta com este e-mail.")

    password = click.prompt(
        "Senha",
        hide_input=True,
        confirmation_prompt="Confirme a senha",
    )

    if len(password) < MINIMUM_PASSWORD_LENGTH:
        raise click.ClickException(
            f"A senha deve ter pelo menos {MINIMUM_PASSWORD_LENGTH} caracteres."
        )

    account = Account(
        name=name,
        email=email,
        role="admin",
        active=True,
    )
    account.set_password(password)
    db.session.add(account)

    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise click.ClickException(
            "Não foi possível criar o administrador. Verifique se o e-mail já existe."
        ) from error

    click.echo(f'Administrador "{email}" criado com sucesso.')
