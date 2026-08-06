from app.database.db import db
from decimal import Decimal


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    category = db.Column(
        db.String(100),
        nullable=False
    )

    price = db.Column(
        db.Numeric(10, 2),
        nullable=False
    )

    stock = db.Column(
        db.Integer,
        default=0
    )

    sale_items = db.relationship(
          "SaleItem",
          back_populates="product",
      )



