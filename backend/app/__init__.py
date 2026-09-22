import os

from flask import Flask
from flask_jwt_extended import JWTManager
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.config import CONFIG_BY_NAME, ConfigurationError
from app.database.db import db, migrate
from app.routes import main_bp

# importa os modelos
from app.models.product import Product
from app.models.customer import Customer
from app.models.seller import Seller
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.account import Account
from app.api.products import products_bp
from app.api.sales import sales_bp
from app.api.customers import customers_bp
from app.api.sellers import sellers_bp
from app.api.docs import docs_bp
from app.api.auth import auth_bp
from app.api.dashboard import dashboard_bp
from app.commands import (
    create_admin_command,
    reset_demo_command,
    seed_demo_command,
)
from app.initial_admin import InitialAdminError, get_or_create_initial_admin

jwt = JWTManager()


def ensure_initial_admin(app):
    if not app.config.get("CREATE_INITIAL_ADMIN"):
        return

    with app.app_context():
        if not inspect(db.engine).has_table(Account.__tablename__):
            return

        try:
            get_or_create_initial_admin(
                app.config.get("INITIAL_ADMIN_NAME"),
                app.config.get("INITIAL_ADMIN_EMAIL"),
                app.config.get("INITIAL_ADMIN_PASSWORD"),
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
        except InitialAdminError as error:
            db.session.rollback()
            raise RuntimeError(
                f"Configuração do administrador inicial inválida: {error}"
            ) from error


def create_app(config_name=None):
    environment = (
        config_name or os.getenv("APP_ENV") or "development"
    ).strip().lower()

    try:
        config_class = CONFIG_BY_NAME[environment]
    except KeyError as error:
        valid_environments = ", ".join(CONFIG_BY_NAME)
        raise ConfigurationError(
            f'APP_ENV inválido: "{environment}". Use um destes valores: '
            f"{valid_environments}."
        ) from error

    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config["APP_ENV"] = environment
    config_class.init_app(app)

    jwt.init_app(app)

    db.init_app(app)
    migrate.init_app(app, db)

    app.register_blueprint(main_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(customers_bp)
    app.register_blueprint(sellers_bp)
    app.register_blueprint(docs_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.cli.add_command(create_admin_command)
    app.cli.add_command(seed_demo_command)
    app.cli.add_command(reset_demo_command)

    ensure_initial_admin(app)

    return app
