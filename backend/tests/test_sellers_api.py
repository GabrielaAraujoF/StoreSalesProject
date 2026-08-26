import pytest

from app.database.db import db
from app.models.seller import Seller


def create_seller(client, *, name="Ana", email="ana@example.com"):
    response = client.post(
        "/api/sellers/",
        json={
            "name": name,
            "email": email,
        },
    )
    assert response.status_code == 201
    return response.get_json()


def test_create_seller_generates_number(client):
    first = create_seller(client)
    second = create_seller(client, name="Bia", email="bia@example.com")

    assert first == {
        "id": 1,
        "seller_number": 1,
        "name": "Ana",
        "email": "ana@example.com",
        "active": True,
    }
    assert second["seller_number"] == 2


def test_list_and_get_sellers(client):
    created = create_seller(client)

    listed = client.get("/api/sellers/")
    fetched = client.get(f"/api/sellers/{created['id']}")

    assert listed.status_code == 200
    assert listed.get_json() == {"sellers": [created]}
    assert fetched.status_code == 200
    assert fetched.get_json() == created


def test_patch_updates_only_name(client):
    created = create_seller(client)

    response = client.patch(
        f"/api/sellers/{created['id']}",
        json={"name": "Ana Silva"},
    )

    assert response.status_code == 200
    assert response.get_json() == {**created, "name": "Ana Silva"}

    seller = db.session.get(Seller, created["id"])
    assert seller.name == "Ana Silva"
    assert seller.email == created["email"]


def test_patch_updates_active(client):
    created = create_seller(client)

    response = client.patch(
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
def test_patch_rejects_invalid_data(client, payload):
    created = create_seller(client)

    response = client.patch(
        f"/api/sellers/{created['id']}",
        json=payload,
    )

    assert response.status_code == 400


def test_patch_rejects_duplicate_email(client):
    first = create_seller(client)
    create_seller(client, name="Bia", email="bia@example.com")

    response = client.patch(
        f"/api/sellers/{first['id']}",
        json={"email": "bia@example.com"},
    )

    assert response.status_code == 409


def test_put_replaces_seller_data(client):
    created = create_seller(client)

    response = client.put(
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


def test_put_rejects_duplicate_email(client):
    first = create_seller(client)
    create_seller(client, name="Bia", email="bia@example.com")

    response = client.put(
        f"/api/sellers/{first['id']}",
        json={
            "name": "Ana",
            "email": "bia@example.com",
            "active": True,
        },
    )

    assert response.status_code == 409


def test_delete_seller(client):
    created = create_seller(client)

    response = client.delete(f"/api/sellers/{created['id']}")

    assert response.status_code == 204
    assert db.session.get(Seller, created["id"]) is None


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_seller_not_found(client, method):
    request_method = getattr(client, method)
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
