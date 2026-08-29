from werkzeug.security import check_password_hash, generate_password_hash

from app.database.db import db


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(
        db.String(100),
        unique=True,
        nullable=False,
    )
    password_hash = db.Column(
        db.String(255),
        nullable=False,
    )
    role = db.Column(
        db.String(20),
        nullable=False,
        default="user",
        server_default="user",
    )
    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        server_default=db.true(),
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

