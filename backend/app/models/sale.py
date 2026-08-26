from datetime import datetime
from decimal import Decimal

from app.database.db import db


class Sale(db.Model):
    __tablename__ = "sales"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(
        db.Integer,
        db.ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    seller_id = db.Column(
        db.Integer,
        db.ForeignKey("sellers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    total = db.Column(
        db.Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    payment_method = db.Column(
        db.String(30),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    customer = db.relationship(
        "Customer",
        back_populates="sales",
    )

    items = db.relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan",
    )

    seller = db.relationship(
        "Seller",
        back_populates="sales",
    )
