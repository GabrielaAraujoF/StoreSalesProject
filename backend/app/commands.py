from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

import click
from flask import current_app
from flask.cli import with_appcontext
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.database.db import db
from app.initial_admin import InitialAdminError, get_or_create_initial_admin
from app.models.account import Account
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.seller import Seller


BRAZIL_TIMEZONE = timezone(timedelta(hours=-3))

DEMO_SELLERS = (
    {
        "name": "Marina Souza",
        "email": "marina.souza@storesales.demo",
        "active": True,
    },
    {
        "name": "Rafael Oliveira",
        "email": "rafael.oliveira@storesales.demo",
        "active": True,
    },
    {
        "name": "Juliana Santos",
        "email": "juliana.santos@storesales.demo",
        "active": True,
    },
    {
        "name": "Paulo Mendes",
        "email": "paulo.mendes@storesales.demo",
        "active": False,
    },
)

DEMO_PRODUCTS = (
    ("Café Especial 500g", "Bebidas", "39.90", 48),
    ("Chá Artesanal 20 sachês", "Bebidas", "24.90", 65),
    ("Caneca de Cerâmica", "Casa", "42.90", 22),
    ("Caderno Pontilhado", "Papelaria", "19.90", 37),
    ("Ecobag StoreSales", "Acessórios", "29.90", 18),
    ("Vela Aromática", "Bem-estar", "37.40", 14),
    ("Granola Artesanal", "Alimentos", "15.90", 53),
    ("Garrafa Térmica", "Casa", "89.90", 8),
    ("Kit Presente", "Presentes", "119.90", 0),
)

DEMO_CUSTOMERS = (
    ("Ana Silva", "(11) 99991-1001"),
    ("Bruno Costa", "(11) 99992-1002"),
    ("Camila Rodrigues", "(11) 99993-1003"),
    ("Diego Martins", "(11) 99994-1004"),
    ("Elisa Ferreira", "(11) 99995-1005"),
    ("Fernanda Lima", "(11) 99996-1006"),
)

DEMO_SALES = (
    {
        "local_datetime": "2026-07-18T10:20:00",
        "seller": "marina.souza@storesales.demo",
        "customer": "(11) 99991-1001",
        "payment_method": "pix",
        "items": (("Café Especial 500g", 2), ("Caneca de Cerâmica", 1)),
    },
    {
        "local_datetime": "2026-08-05T14:15:00",
        "seller": "rafael.oliveira@storesales.demo",
        "customer": "(11) 99992-1002",
        "payment_method": "credit_card",
        "items": (("Garrafa Térmica", 1), ("Chá Artesanal 20 sachês", 2)),
    },
    {
        "local_datetime": "2026-08-22T16:40:00",
        "seller": "juliana.santos@storesales.demo",
        "customer": "(11) 99993-1003",
        "payment_method": "debit_card",
        "items": (("Caderno Pontilhado", 3), ("Ecobag StoreSales", 1)),
    },
    {
        "local_datetime": "2026-09-02T09:10:00",
        "seller": "marina.souza@storesales.demo",
        "customer": "(11) 99991-1001",
        "payment_method": "cash",
        "items": (("Café Especial 500g", 1), ("Granola Artesanal", 2)),
    },
    {
        "local_datetime": "2026-09-04T11:35:00",
        "seller": "rafael.oliveira@storesales.demo",
        "customer": "(11) 99994-1004",
        "payment_method": "pix",
        "items": (("Garrafa Térmica", 1), ("Café Especial 500g", 1)),
    },
    {
        "local_datetime": "2026-09-06T15:20:00",
        "seller": "juliana.santos@storesales.demo",
        "customer": "(11) 99995-1005",
        "payment_method": "credit_card",
        "items": (("Vela Aromática", 2), ("Chá Artesanal 20 sachês", 1)),
    },
    {
        "local_datetime": "2026-09-08T10:45:00",
        "seller": "marina.souza@storesales.demo",
        "customer": None,
        "payment_method": "debit_card",
        "items": (("Caneca de Cerâmica", 2), ("Caderno Pontilhado", 1)),
    },
    {
        "local_datetime": "2026-09-10T13:15:00",
        "seller": "rafael.oliveira@storesales.demo",
        "customer": "(11) 99996-1006",
        "payment_method": "cash",
        "items": (("Granola Artesanal", 3), ("Ecobag StoreSales", 1)),
    },
    {
        "local_datetime": "2026-09-12T17:30:00",
        "seller": "juliana.santos@storesales.demo",
        "customer": "(11) 99992-1002",
        "payment_method": "pix",
        "items": (("Café Especial 500g", 2), ("Garrafa Térmica", 1)),
    },
    {
        "local_datetime": "2026-09-14T09:50:00",
        "seller": "marina.souza@storesales.demo",
        "customer": "(11) 99993-1003",
        "payment_method": "credit_card",
        "items": (
            ("Caneca de Cerâmica", 1),
            ("Vela Aromática", 1),
            ("Caderno Pontilhado", 2),
        ),
    },
    {
        "local_datetime": "2026-09-15T14:05:00",
        "seller": "rafael.oliveira@storesales.demo",
        "customer": "(11) 99994-1004",
        "payment_method": "debit_card",
        "items": (("Chá Artesanal 20 sachês", 3), ("Granola Artesanal", 1)),
    },
    {
        "local_datetime": "2026-09-16T11:25:00",
        "seller": "juliana.santos@storesales.demo",
        "customer": "(11) 99991-1001",
        "payment_method": "pix",
        "items": (("Ecobag StoreSales", 2), ("Café Especial 500g", 1)),
    },
)


def demo_utc_datetime(local_datetime):
    local_value = datetime.fromisoformat(local_datetime).replace(
        tzinfo=BRAZIL_TIMEZONE
    )
    return local_value.astimezone(UTC).replace(tzinfo=None)


def configured_initial_admin():
    return get_or_create_initial_admin(
        current_app.config.get("INITIAL_ADMIN_NAME"),
        current_app.config.get("INITIAL_ADMIN_EMAIL"),
        current_app.config.get("INITIAL_ADMIN_PASSWORD"),
    )


def upsert_demo_sellers():
    sellers = {}
    created_count = 0
    next_number = db.session.scalar(db.select(db.func.max(Seller.seller_number))) or 0

    for seller_data in DEMO_SELLERS:
        seller = Seller.query.filter_by(email=seller_data["email"]).first()

        if seller is None:
            next_number += 1
            seller = Seller(
                email=seller_data["email"],
                seller_number=next_number,
            )
            db.session.add(seller)
            created_count += 1

        seller.name = seller_data["name"]
        seller.active = seller_data["active"]
        sellers[seller.email] = seller

    return sellers, created_count


def upsert_demo_products():
    products = {}
    created_count = 0

    for name, category, price, stock in DEMO_PRODUCTS:
        product = Product.query.filter_by(name=name).first()

        if product is None:
            product = Product(
                name=name,
                category=category,
                price=Decimal(price),
                stock=stock,
            )
            db.session.add(product)
            created_count += 1

        products[name] = product

    return products, created_count


def upsert_demo_customers():
    customers = {}
    created_count = 0

    for name, phone in DEMO_CUSTOMERS:
        customer = Customer.query.filter_by(phone=phone).first()

        if customer is None:
            customer = Customer(name=name, phone=phone)
            db.session.add(customer)
            created_count += 1

        customers[phone] = customer

    return customers, created_count


def create_missing_demo_sales(sellers, products, customers):
    created_count = 0
    skipped_count = 0

    db.session.flush()

    for sale_data in DEMO_SALES:
        created_at = demo_utc_datetime(sale_data["local_datetime"])
        seller = sellers[sale_data["seller"]]
        existing_sale = Sale.query.filter_by(
            created_at=created_at,
            seller_id=seller.id,
            payment_method=sale_data["payment_method"],
        ).first()

        if existing_sale is not None:
            skipped_count += 1
            continue

        customer_phone = sale_data["customer"]
        sale = Sale(
            customer=customers.get(customer_phone),
            seller=seller,
            payment_method=sale_data["payment_method"],
            created_at=created_at,
            total=Decimal("0.00"),
        )
        total = Decimal("0.00")

        for product_name, quantity in sale_data["items"]:
            product = products[product_name]
            subtotal = product.price * quantity
            total += subtotal
            sale.items.append(SaleItem(
                product=product,
                quantity=quantity,
                unit_price=product.price,
                subtotal=subtotal,
            ))

        sale.total = total
        db.session.add(sale)
        created_count += 1

    return created_count, skipped_count


def seed_demo_data():
    account, account_created = configured_initial_admin()
    sellers, sellers_created = upsert_demo_sellers()
    products, products_created = upsert_demo_products()
    customers, customers_created = upsert_demo_customers()
    sales_created, sales_skipped = create_missing_demo_sales(
        sellers,
        products,
        customers,
    )
    return {
        "account": account,
        "account_created": account_created,
        "sellers_created": sellers_created,
        "products_created": products_created,
        "customers_created": customers_created,
        "sales_created": sales_created,
        "sales_skipped": sales_skipped,
    }


def delete_demo_data():
    for model in (SaleItem, Sale, Product, Customer, Seller, Account):
        db.session.execute(db.delete(model))


def echo_seed_summary(result):
    click.echo(
        f"Criados: {int(result['account_created'])} administrador, "
        f"{result['sellers_created']} vendedores, "
        f"{result['products_created']} produtos, "
        f"{result['customers_created']} clientes e "
        f"{result['sales_created']} vendas."
    )
    click.echo(
        f"Vendas já existentes preservadas: {result['sales_skipped']}."
    )
    click.echo(f"Login administrativo: {result['account'].email}")


@click.command("create-admin")
@with_appcontext
def create_admin_command():
    """Cria o administrador inicial configurado no ambiente."""
    try:
        account, created = configured_initial_admin()
    except InitialAdminError as error:
        raise click.ClickException(str(error)) from error

    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        existing_account, created = configured_initial_admin()

        if created:
            db.session.rollback()
            raise click.ClickException(
                "Não foi possível criar o administrador. "
                "Tente executar o comando novamente."
            ) from error

        account = existing_account

    if created:
        click.echo(f'Administrador "{account.email}" criado com sucesso.')
    else:
        click.echo(
            f'Administrador "{account.email}" já existe; nenhuma alteração foi realizada.'
        )


@click.command("seed-demo")
@with_appcontext
def seed_demo_command():
    """Cria uma carga demonstrativa sem duplicar os registros existentes."""
    try:
        result = seed_demo_data()
        db.session.commit()
    except InitialAdminError as error:
        db.session.rollback()
        raise click.ClickException(str(error)) from error
    except SQLAlchemyError as error:
        db.session.rollback()
        raise click.ClickException(
            "Não foi possível criar os dados demonstrativos. "
            "Execute as migrations antes do seed."
        ) from error

    click.echo("Seed demonstrativo concluído.")
    echo_seed_summary(result)


@click.command("reset-demo")
@click.option(
    "--yes",
    "assume_yes",
    is_flag=True,
    help="Confirma o descarte dos dados sem solicitar entrada interativa.",
)
@with_appcontext
def reset_demo_command(assume_yes):
    """Descarta alterações e restaura a carga demonstrativa original."""
    if not current_app.config.get("DEMO_RESET_ENABLED"):
        raise click.ClickException(
            "O reset da demonstração está desabilitado. "
            "Defina DEMO_RESET_ENABLED=true para habilitá-lo."
        )

    database_uri = str(current_app.config["SQLALCHEMY_DATABASE_URI"])

    if not database_uri.startswith("sqlite:"):
        raise click.ClickException(
            "O comando reset-demo só pode ser executado em um banco SQLite."
        )

    if not assume_yes:
        click.confirm(
            "Todos os dados atuais serão descartados e substituídos pela demo. "
            "Deseja continuar?",
            abort=True,
        )

    try:
        delete_demo_data()
        result = seed_demo_data()
        db.session.commit()
    except InitialAdminError as error:
        db.session.rollback()
        raise click.ClickException(str(error)) from error
    except SQLAlchemyError as error:
        db.session.rollback()
        raise click.ClickException(
            "Não foi possível restaurar a demonstração. "
            "O banco anterior foi preservado; verifique as migrations."
        ) from error

    click.echo("Demonstração restaurada com sucesso.")
    echo_seed_summary(result)
