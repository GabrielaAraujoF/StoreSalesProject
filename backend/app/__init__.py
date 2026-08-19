from flask import Flask
from app.config import CONFIG_BY_NAME, Config
from app.database.db import db, migrate
from app.routes import main_bp

# importa os modelos
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.api.products import products_bp
from app.api.sales import sales_bp
from app.api.customers import customers_bp
from app.api.docs import docs_bp

def create_app(config_name=None):
    app = Flask(__name__)
    config_class = CONFIG_BY_NAME.get(config_name, Config)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    app.register_blueprint(main_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(customers_bp)
    app.register_blueprint(docs_bp)

    return app
