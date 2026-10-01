from decimal import Decimal

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app import commands
from app.commands import (
    DEMO_CUSTOMERS,
    DEMO_PRODUCTS,
    DEMO_SELLERS,
    PUBLIC_DEMO_SELLERS,
)
from app.database.db import db
from app.models.account import Account
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.seller import Seller


def configure_demo(app, *, reset_enabled=False):
    app.config.update(
        INITIAL_ADMIN_NAME="Administrador Demo",
        INITIAL_ADMIN_EMAIL="admin@storesales.demo",
        INITIAL_ADMIN_PASSWORD="senha-demo-segura",
        DEMO_RESET_ENABLED=reset_enabled,
    )


def demo_counts():
    return {
        "accounts": Account.query.count(),
        "sellers": Seller.query.count(),
        "products": Product.query.count(),
        "customers": Customer.query.count(),
        "sales": Sale.query.count(),
        "sale_items": SaleItem.query.count(),
    }


def test_create_admin_command(app):
    app.config.update(
        INITIAL_ADMIN_NAME="Administrador",
        INITIAL_ADMIN_EMAIL="ADMIN@example.com",
        INITIAL_ADMIN_PASSWORD="senha-segura",
    )
    runner = app.test_cli_runner()

    result = runner.invoke(args=["create-admin"])

    assert result.exit_code == 0
    assert 'Administrador "admin@example.com" criado com sucesso.' in result.output

    account = Account.query.one()
    assert account.name == "Administrador"
    assert account.email == "admin@example.com"
    assert account.role == "admin"
    assert account.active is True
    assert account.password_hash != "senha-segura"
    assert account.check_password("senha-segura") is True


def test_create_admin_command_is_idempotent(app):
    app.config.update(
        INITIAL_ADMIN_NAME="Administrador",
        INITIAL_ADMIN_EMAIL="admin@example.com",
        INITIAL_ADMIN_PASSWORD="senha-segura",
    )
    runner = app.test_cli_runner()

    first_result = runner.invoke(args=["create-admin"])
    first_password_hash = Account.query.one().password_hash
    second_result = runner.invoke(args=["create-admin"])

    assert first_result.exit_code == 0
    assert second_result.exit_code == 0
    assert "já existe; nenhuma alteração foi realizada" in second_result.output
    assert Account.query.count() == 1
    assert Account.query.one().password_hash == first_password_hash


def test_create_admin_command_rejects_short_password(app):
    app.config.update(
        INITIAL_ADMIN_NAME="Administrador",
        INITIAL_ADMIN_EMAIL="admin@example.com",
        INITIAL_ADMIN_PASSWORD="curta",
    )
    runner = app.test_cli_runner()

    result = runner.invoke(args=["create-admin"])

    assert result.exit_code == 1
    assert "A senha deve ter pelo menos 8 caracteres." in result.output
    assert Account.query.count() == 0


def test_create_admin_command_requires_environment_configuration(app):
    app.config.update(
        INITIAL_ADMIN_NAME=None,
        INITIAL_ADMIN_EMAIL=None,
        INITIAL_ADMIN_PASSWORD=None,
    )
    runner = app.test_cli_runner()

    result = runner.invoke(args=["create-admin"])

    assert result.exit_code == 1
    assert "INITIAL_ADMIN_NAME" in result.output
    assert "INITIAL_ADMIN_EMAIL" in result.output
    assert "INITIAL_ADMIN_PASSWORD" in result.output
    assert Account.query.count() == 0


def test_seed_demo_command_creates_only_default_seller(app):
    runner = app.test_cli_runner()

    result = runner.invoke(args=["seed-demo"])

    assert result.exit_code == 0
    assert "Seed de vendedores demo concluído." in result.output
    assert '"ana.demo@storesales.local" criado.' in result.output
    assert [
        (seller.name, seller.email, seller.active)
        for seller in Seller.query.order_by(Seller.seller_number).all()
    ] == [
        (seller["name"], seller["email"], True)
        for seller in PUBLIC_DEMO_SELLERS
    ]
    assert Account.query.count() == 0
    assert Product.query.count() == 0
    assert Customer.query.count() == 0
    assert Sale.query.count() == 0


def test_seed_demo_command_is_idempotent_and_repairs_default_seller(app):
    existing_demo = Seller(
        name="Ana cadastrada manualmente",
        seller_number=40,
        email="ana.demo@storesales.local",
        active=False,
    )
    manual_seller = Seller(
        name="Vendedor manual",
        seller_number=41,
        email="manual@example.com",
        active=True,
    )
    legacy_seller = Seller(
        name="Carlos Demo",
        seller_number=42,
        email="carlos.demo@storesales.local",
        active=True,
    )
    legacy_sale = Sale(
        seller=legacy_seller,
        payment_method="cash",
        total=Decimal("0.00"),
    )
    db.session.add_all([
        existing_demo,
        manual_seller,
        legacy_seller,
        legacy_sale,
    ])
    db.session.commit()
    legacy_sale_id = legacy_sale.id
    runner = app.test_cli_runner()

    first_result = runner.invoke(args=["seed-demo"])
    second_result = runner.invoke(args=["seed-demo"])

    assert first_result.exit_code == 0
    assert second_result.exit_code == 0
    assert (
        '"ana.demo@storesales.local" já existia e foi mantido.'
        in first_result.output
    )
    assert "Carlos Demo removido" in first_result.output
    assert second_result.output.count("já existia e foi mantido") == 1
    assert Seller.query.count() == 2

    preserved_demo = Seller.query.filter_by(
        email="ana.demo@storesales.local"
    ).one()
    preserved_manual = Seller.query.filter_by(email="manual@example.com").one()
    assert preserved_demo.name == "Ana Demo"
    assert preserved_demo.seller_number == 40
    assert preserved_demo.active is True
    assert preserved_manual.name == "Vendedor manual"
    assert preserved_manual.seller_number == 41
    assert preserved_manual.active is True
    assert Seller.query.filter_by(
        email="carlos.demo@storesales.local"
    ).one_or_none() is None
    assert db.session.get(Sale, legacy_sale_id).seller_id == preserved_demo.id


def test_reset_demo_command_restores_original_data_and_preserves_schema(app):
    configure_demo(app, reset_enabled=True)
    runner = app.test_cli_runner()
    assert runner.invoke(args=["reset-demo", "--yes"]).exit_code == 0
    tables_before = set(inspect(db.engine).get_table_names())

    Product.query.filter_by(name=DEMO_PRODUCTS[0][0]).one().stock = 999
    db.session.add(Product(
        name="Produto do visitante",
        category="Teste",
        price=Decimal("12.34"),
        stock=7,
    ))
    db.session.add(Customer(name="Cliente do visitante", phone="(11) 90000-0000"))
    db.session.add(Seller(
        name="Vendedor do visitante",
        seller_number=999,
        email="visitante@example.com",
        active=True,
    ))
    extra_account = Account(
        name="Outro administrador",
        email="outro@example.com",
        role="admin",
        active=True,
    )
    extra_account.set_password("senha-extra-segura")
    db.session.add(extra_account)
    db.session.commit()

    result = runner.invoke(args=["reset-demo", "--yes"])

    assert result.exit_code == 0
    assert "Demonstração restaurada com sucesso." in result.output
    assert demo_counts() == {
        "accounts": 1,
        "sellers": 5,
        "products": 9,
        "customers": 6,
        "sales": 12,
        "sale_items": 25,
    }
    assert set(inspect(db.engine).get_table_names()) == tables_before
    assert {
        (product.name, product.category, str(product.price), product.stock)
        for product in Product.query.all()
    } == set(DEMO_PRODUCTS)
    assert {
        (customer.name, customer.phone)
        for customer in Customer.query.all()
    } == set(DEMO_CUSTOMERS)
    assert {
        (seller.name, seller.email, seller.active)
        for seller in Seller.query.all()
    } == {
        (seller["name"], seller["email"], seller["active"])
        for seller in (*DEMO_SELLERS, *PUBLIC_DEMO_SELLERS)
    }
    admin = Account.query.one()
    assert admin.email == "admin@storesales.demo"
    assert admin.check_password("senha-demo-segura") is True

    second_result = runner.invoke(args=["reset-demo", "--yes"])

    assert second_result.exit_code == 0
    assert demo_counts()["sales"] == 12


def test_reset_demo_command_is_disabled_by_default(app):
    configure_demo(app)
    customer = Customer(name="Cliente preservado", phone="(11) 98888-0000")
    db.session.add(customer)
    db.session.commit()

    result = app.test_cli_runner().invoke(args=["reset-demo", "--yes"])

    assert result.exit_code == 1
    assert "reset da demonstração está desabilitado" in result.output
    assert Customer.query.filter_by(phone="(11) 98888-0000").one() is customer


def test_reset_demo_command_requires_confirmation(app):
    configure_demo(app, reset_enabled=True)
    customer = Customer(name="Cliente preservado", phone="(11) 97777-0000")
    db.session.add(customer)
    db.session.commit()

    result = app.test_cli_runner().invoke(args=["reset-demo"], input="n\n")

    assert result.exit_code == 1
    assert "Aborted" in result.output
    assert Customer.query.filter_by(phone="(11) 97777-0000").one() is customer


def test_reset_demo_command_refuses_non_sqlite_database(app):
    configure_demo(app, reset_enabled=True)
    app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://example.invalid/demo"

    result = app.test_cli_runner().invoke(args=["reset-demo", "--yes"])

    assert result.exit_code == 1
    assert "só pode ser executado em um banco SQLite" in result.output


def test_reset_demo_command_rolls_back_if_reseeding_fails(app, monkeypatch):
    configure_demo(app, reset_enabled=True)
    runner = app.test_cli_runner()
    assert runner.invoke(args=["reset-demo", "--yes"]).exit_code == 0
    customer = Customer(name="Cliente preservado", phone="(11) 96666-0000")
    db.session.add(customer)
    db.session.commit()
    counts_before = demo_counts()

    def fail_to_seed_products():
        raise SQLAlchemyError("falha simulada")

    monkeypatch.setattr(commands, "upsert_demo_products", fail_to_seed_products)

    result = runner.invoke(args=["reset-demo", "--yes"])

    assert result.exit_code == 1
    assert "O banco anterior foi preservado" in result.output
    assert demo_counts() == counts_before
    assert Customer.query.filter_by(phone="(11) 96666-0000").one() is customer


def test_reset_demo_is_not_exposed_as_an_api(client):
    response = client.post("/api/reset-demo")

    assert response.status_code == 404
