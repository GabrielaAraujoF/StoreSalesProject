from flask import Flask
from app.config import Config
from app.database.db import db
from app.routes import main_bp

# importa os modelos
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    app.register_blueprint(main_bp)

    return app
