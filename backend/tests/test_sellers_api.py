import pytest

from app.database.db import db
from app.models.seller import Seller


def create_seller(admin_client, *, name="Ana", email="ana@example.com"):
    response = admin_client.post(
        "/api/sellers/",
        json={
            "name": name,
            "email": email,
        },
    )
    assert response.status_code == 201
    return response.get_json()


def test_create_seller_generates_number(admin_client):
    first = create_seller(admin_client)
    second = create_seller(admin_client, name="Bia", email="bia@example.com")

    assert first == {
        "id": 1,
        "seller_number": 1,
        "name": "Ana",
        "email": "ana@example.com",
        "active": True,
    }
    assert second["seller_number"] == 2


def test_create_rejects_duplicate_email_with_specific_error(admin_client):
    create_seller(admin_client)

    response = admin_client.post(
        "/api/sellers/",
        json={
            "name": "Outra Ana",
            "email": "ana@example.com",
        },
    )

    assert response.status_code == 409
    assert response.get_json() == {
        "error": "Já existe um vendedor com este e-mail.",
        "code": "seller_email_conflict",
    }


def test_create_reports_seller_number_conflict(admin_client, monkeypatch):
    create_seller(admin_client)
    monkeypatch.setattr(db.session, "scalar", lambda statement: 0)

    response = admin_client.post(
        "/api/sellers/",
        json={
            "name": "Bia",
            "email": "bia@example.com",
        },
    )

    assert response.status_code == 409
    assert response.get_json() == {
        "error": "Já existe um vendedor com este número.",
        "code": "seller_number_conflict",
    }


def test_list_and_get_sellers(admin_client):
    created = create_seller(admin_client)

    listed = admin_client.get("/api/sellers/")
    fetched = admin_client.get(f"/api/sellers/{created['id']}")

    assert listed.status_code == 200
    assert listed.get_json() == {"sellers": [created]}
    assert fetched.status_code == 200
    assert fetched.get_json() == created


def test_list_active_sellers_is_public_and_returns_minimum_data(client):
    db.session.add_all(
        [
            Seller(
                seller_number=102,
                name="João Silva",
                email="joao@example.com",
                active=True,
            ),
            Seller(
                seller_number=101,
                name="Maria Souza",
                email="maria@example.com",
                active=False,
            ),
        ]
    )
    db.session.commit()

    response = client.get("/api/sellers/active")

    assert response.status_code == 200
    assert response.get_json() == {
        "sellers": [
            {
                "id": 1,
                "seller_number": 102,
                "name": "João Silva",
            }
        ]
    }


@pytest.mark.parametrize("path", ["/api/sellers/", "/api/sellers/1"])
def test_full_seller_data_requires_authentication(client, path):
    response = client.get(path)

    assert response.status_code == 401


def test_patch_updates_only_name(admin_client):
    created = create_seller(admin_client)

    response = admin_client.patch(
        f"/api/sellers/{created['id']}",
        json={"name": "Ana Silva"},
    )

    assert response.status_code == 200
    assert response.get_json() == {**created, "name": "Ana Silva"}

    seller = db.session.get(Seller, created["id"])
    assert seller.name == "Ana Silva"
    assert seller.email == created["email"]


def test_patch_updates_active(admin_client):
    created = create_seller(admin_client)

    response = admin_client.patch(
        f"/api/sellers/{created['id']}",
        json={"active": False},
    )

    assert response.status_code == 200
    assert response.get_json() == {**created, "active": False}


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": ""},
        {"email": None},
        {"active": 1},
        {"seller_number": 999},
        {"unknown": "value"},
    ],
)
def test_patch_rejects_invalid_data(admin_client, payload):
    created = create_seller(admin_client)

    response = admin_client.patch(
        f"/api/sellers/{created['id']}",
        json=payload,
    )

    assert response.status_code == 400


def test_patch_rejects_duplicate_email(admin_client):
    first = create_seller(admin_client)
    create_seller(admin_client, name="Bia", email="bia@example.com")

    response = admin_client.patch(
        f"/api/sellers/{first['id']}",
        json={"email": "bia@example.com"},
    )

    assert response.status_code == 409
    assert response.get_json() == {
        "error": "Já existe um vendedor com este e-mail.",
        "code": "seller_email_conflict",
    }


def test_put_replaces_seller_data(admin_client):
    created = create_seller(admin_client)

    response = admin_client.put(
        f"/api/sellers/{created['id']}",
        json={
            "name": "Ana Souza",
            "email": "ana.souza@example.com",
            "active": False,
        },
    )

    assert response.status_code == 200
    assert response.get_json() == {
        **created,
        "name": "Ana Souza",
        "email": "ana.souza@example.com",
        "active": False,
    }


def test_put_rejects_duplicate_email(admin_client):
    first = create_seller(admin_client)
    create_seller(admin_client, name="Bia", email="bia@example.com")

    response = admin_client.put(
        f"/api/sellers/{first['id']}",
        json={
            "name": "Ana",
            "email": "bia@example.com",
            "active": True,
        },
    )

    assert response.status_code == 409
    assert response.get_json() == {
        "error": "Já existe um vendedor com este e-mail.",
        "code": "seller_email_conflict",
    }


def test_delete_seller(admin_client):
    created = create_seller(admin_client)

    response = admin_client.delete(f"/api/sellers/{created['id']}")

    assert response.status_code == 204
    assert db.session.get(Seller, created["id"]) is None


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_seller_not_found(admin_client, method):
    request_method = getattr(admin_client, method)
    kwargs = {}

    if method == "patch":
        kwargs["json"] = {"name": "Ana"}
    elif method == "put":
        kwargs["json"] = {
            "name": "Ana",
            "email": "ana@example.com",
            "active": True,
        }

    response = request_method("/api/sellers/99999", **kwargs)

    assert response.status_code == 404


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
def test_seller_mutations_require_authentication(client, method, path, payload):
    request_method = getattr(client, method)
    kwargs = {"json": payload} if payload is not None else {}

    response = request_method(path, **kwargs)

    assert response.status_code == 401
