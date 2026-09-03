from flask import Flask
from flask_jwt_extended import JWTManager
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.config import CONFIG_BY_NAME, Config
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
from app.commands import create_admin_command

jwt = JWTManager()


def ensure_initial_admin(app):
    password = app.config.get("INITIAL_ADMIN_PASSWORD")

    if not app.config.get("CREATE_INITIAL_ADMIN") or not password:
        return

    with app.app_context():
        if not inspect(db.engine).has_table(Account.__tablename__):
            return

        email = app.config["INITIAL_ADMIN_EMAIL"].strip().lower()

        if Account.query.filter_by(email=email).first() is not None:
            return

        account = Account(
            name=app.config["INITIAL_ADMIN_NAME"],
            email=email,
            role="admin",
            active=True,
        )
        account.set_password(password)
        db.session.add(account)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()


def create_app(config_name=None):
    app = Flask(__name__)
    config_class = CONFIG_BY_NAME.get(config_name, Config)
    app.config.from_object(config_class)

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

    ensure_initial_admin(app)

    return app
