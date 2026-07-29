from app.database.db import db
from datetime import datetime
from decimal import Decimal

class Sale(db.Model):
    __tablename__ = "sales"

    id = db.Column(db.Integer, primary_key=True)
    
    total = db.Column(db.Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    payment_method = db.Column(db.String(30), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
