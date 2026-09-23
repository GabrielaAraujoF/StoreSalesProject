from app.database.db import db


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(
        db.String(20),
        nullable=True,
        unique=True,
        index=True,
    )

    sales = db.relationship(
        "Sale",
        back_populates="customer",
    )

    def __repr__(self):
        return f"<Customer {self.name}>"