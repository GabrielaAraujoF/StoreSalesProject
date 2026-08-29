import pytest

from app import create_app
from app.database.db import db
from app.models.account import Account


@pytest.fixture()
def app():
    app = create_app("testing")

    with app.app_context():
        db.create_all()

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def account_factory():
    def create_account(
        *,
        name="Administrador",
        email="admin@example.com",
        password="senha-segura",
        role="admin",
        active=True,
    ):
        account = Account(
            name=name,
            email=email.strip().lower(),
            role=role,
            active=active,
        )
        account.set_password(password)
        db.session.add(account)
        db.session.commit()
        return account

    return create_account


@pytest.fixture()
def admin_client(client, account_factory):
    account_factory()
    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@example.com",
            "password": "senha-segura",
        },
    )

    assert response.status_code == 200

    csrf_cookie = client.get_cookie("csrf_access_token")
    assert csrf_cookie is not None
    client.environ_base["HTTP_X_CSRF_TOKEN"] = csrf_cookie.value

    return client
