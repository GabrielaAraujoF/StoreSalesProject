import pytest

from app import ensure_initial_admin
from app.models.account import Account


def login(client, *, email="admin@example.com", password="senha-segura"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


def test_initial_admin_is_created_once_in_development(app):
    app.config.update(
        CREATE_INITIAL_ADMIN=True,
        INITIAL_ADMIN_NAME="Administrador",
        INITIAL_ADMIN_EMAIL="admin@admin.com",
        INITIAL_ADMIN_PASSWORD="test-initial-password",
    )

    ensure_initial_admin(app)
    ensure_initial_admin(app)

    accounts = Account.query.filter_by(email="admin@admin.com").all()

    assert len(accounts) == 1
    assert accounts[0].name == "Administrador"
    assert accounts[0].role == "admin"
    assert accounts[0].active is True
    assert accounts[0].check_password("test-initial-password")


def test_login_sets_authentication_cookies(client, account_factory):
    account = account_factory()

    response = login(client, email="  ADMIN@EXAMPLE.COM  ")

    assert response.status_code == 200
    assert response.get_json() == {
        "message": "Login realizado com sucesso.",
        "account": {
            "id": account.id,
            "name": account.name,
            "email": account.email,
            "role": "admin",
            "active": True,
        },
    }
    assert client.get_cookie("access_token_cookie") is not None
    assert client.get_cookie("csrf_access_token") is not None


def test_get_current_account(client, account_factory):
    account = account_factory()
    assert login(client).status_code == 200

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.get_json() == {
        "account": {
            "id": account.id,
            "name": account.name,
            "email": account.email,
            "role": account.role,
            "active": True,
        }
    }


def test_get_current_account_requires_authentication(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_get_current_account_rejects_account_deactivated_after_login(
    client,
    account_factory,
):
    account = account_factory()
    assert login(client).status_code == 200
    account.active = False

    response = client.get("/api/auth/me")

    assert response.status_code == 403
    assert response.get_json() == {"error": "Conta inativa."}


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {},
        {"email": "", "password": "senha-segura"},
        {"email": "admin@example.com"},
        {"email": "admin@example.com", "password": ""},
    ],
)
def test_login_rejects_invalid_payload(client, payload):
    response = client.post("/api/auth/login", json=payload)

    assert response.status_code == 400


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("missing@example.com", "senha-segura"),
        ("admin@example.com", "senha-incorreta"),
    ],
)
def test_login_rejects_invalid_credentials(
    client,
    account_factory,
    email,
    password,
):
    account_factory()

    response = login(client, email=email, password=password)

    assert response.status_code == 401
    assert response.get_json() == {"error": "E-mail ou senha inválidos."}


def test_login_rejects_inactive_account(client, account_factory):
    account_factory(active=False)

    response = login(client)

    assert response.status_code == 403
    assert response.get_json() == {"error": "Conta inativa."}


def test_logout_clears_authentication_cookies(client, account_factory):
    account_factory()
    assert login(client).status_code == 200
    csrf_cookie = client.get_cookie("csrf_access_token")

    response = client.post(
        "/api/auth/logout",
        headers={"X-CSRF-TOKEN": csrf_cookie.value},
    )

    assert response.status_code == 200
    assert client.get_cookie("access_token_cookie") is None
    assert client.get_cookie("csrf_access_token") is None


def test_logout_requires_csrf_token(client, account_factory):
    account_factory()
    assert login(client).status_code == 200

    response = client.post("/api/auth/logout")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        (
            "post",
            "/api/sellers/",
            {"name": "Ana", "email": "ana@example.com"},
        ),
        ("patch", "/api/sellers/1", {"name": "Ana Silva"}),
        (
            "put",
            "/api/sellers/1",
            {
                "name": "Ana",
                "email": "ana@example.com",
                "active": True,
            },
        ),
        ("delete", "/api/sellers/1", None),
    ],
)
def test_seller_mutations_reject_non_admin(
    client,
    account_factory,
    method,
    path,
    payload,
):
    account_factory(role="user")
    assert login(client).status_code == 200
    csrf_cookie = client.get_cookie("csrf_access_token")
    request_method = getattr(client, method)
    kwargs = {
        "headers": {"X-CSRF-TOKEN": csrf_cookie.value},
    }

    if payload is not None:
        kwargs["json"] = payload

    response = request_method(path, **kwargs)

    assert response.status_code == 403
    assert response.get_json() == {"error": "Acesso não autorizado."}


@pytest.mark.parametrize("path", ["/api/sellers/", "/api/sellers/1"])
def test_full_seller_data_rejects_non_admin(client, account_factory, path):
    account_factory(role="user")
    assert login(client).status_code == 200

    response = client.get(path)

    assert response.status_code == 403
    assert response.get_json() == {"error": "Acesso não autorizado."}
