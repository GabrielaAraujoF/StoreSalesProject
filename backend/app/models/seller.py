from app.database.db import db

class Seller(db.Model):
    __tablename__ = "sellers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    seller_number = db.Column(
        db.Integer,
        unique=True,
        nullable=False,
    )

    email = db.Column(
        db.String(100),
        unique=True,
        nullable=False,
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        server_default=db.true(),
    )   

    sales = db.relationship(   
            "Sale",
            back_populates="seller",
    )
    
    def __repr__(self):
            return f"<Seller {self.name}>"
