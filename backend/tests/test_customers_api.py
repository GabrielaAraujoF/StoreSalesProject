import pytest


def create_customer(client, *, name="Gabriel", phone="11999999999"):
    return client.post(
        "/api/customers/",
        json={"name": name, "phone": phone},
    )


def test_create_customer(client):
    response = create_customer(client)

    assert response.status_code == 201
    customer = response.get_json()
    assert customer["id"] is not None
    assert customer["name"] == "Gabriel"
    assert customer["phone"] == "11999999999"


def test_list_customers(client):
    first = create_customer(client).get_json()
    second = create_customer(
        client,
        name="Maria",
        phone="11888888888",
    ).get_json()

    response = client.get("/api/customers/")

    assert response.status_code == 200
    assert response.get_json()["customers"] == [first, second]


def test_get_customer_by_id(client):
    created = create_customer(client).get_json()

    response = client.get(f"/api/customers/{created['id']}")

    assert response.status_code == 200
    assert response.get_json() == created


def test_get_customer_by_phone(client):
    created = create_customer(client).get_json()

    response = client.get(
        "/api/customers/by-phone",
        query_string={"phone": created["phone"]},
    )

    assert response.status_code == 200
    assert response.get_json() == created


def test_update_customer(client):
    created = create_customer(client).get_json()

    response = client.put(
        f"/api/customers/{created['id']}",
        json={"name": "Gabriel Silva", "phone": "11777777777"},
    )

    assert response.status_code == 200
    customer = response.get_json()
    assert customer["name"] == "Gabriel Silva"
    assert customer["phone"] == "11777777777"


def test_delete_customer(client):
    created = create_customer(client).get_json()

    response = client.delete(f"/api/customers/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/customers/{created['id']}").status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": ""},
        {"name": "   "},
        {"name": 123},
        {"name": "Gabriel", "phone": 11999999999},
    ],
)
def test_reject_invalid_customer_data(client, payload):
    response = client.post("/api/customers/", json=payload)

    assert response.status_code == 400


def test_reject_duplicate_phone_on_create(client):
    create_customer(client)

    response = create_customer(client, name="Maria")

    assert response.status_code == 409
    assert response.get_json()["error"] == (
        "Já existe um cliente com este telefone."
    )


def test_reject_duplicate_phone_on_update(client):
    create_customer(client)
    second = create_customer(
        client,
        name="Maria",
        phone="11888888888",
    ).get_json()

    response = client.put(
        f"/api/customers/{second['id']}",
        json={"name": "Maria", "phone": "11999999999"},
    )

    assert response.status_code == 409


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_customer_not_found(client, method):
    request_method = getattr(client, method)
    kwargs = {"json": {"name": "Gabriel"}} if method == "put" else {}

    response = request_method("/api/customers/99999", **kwargs)

    assert response.status_code == 404
    assert response.get_json()["error"] == "Cliente não encontrado."


@pytest.mark.parametrize(
    ("query_string", "expected_status"),
    [
        ({}, 400),
        ({"phone": ""}, 400),
        ({"phone": "11000000000"}, 404),
    ],
)
def test_get_customer_by_phone_errors(client, query_string, expected_status):
    response = client.get(
        "/api/customers/by-phone",
        query_string=query_string,
    )

    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "x" * 101, "phone": "11999999999"},
        {"name": "Gabriel", "phone": "1" * 21},
    ],
)
def test_reject_customer_fields_over_database_limit(client, payload):
    response = client.post("/api/customers/", json=payload)

    assert response.status_code == 400