
import pytest


def create_product(client):
      return client.post(
          "/api/products/",
          json={
              "name": "Café",
              "category": "Alimentos",
              "price": "18.90",
              "stock": 20,
          },
      )


def test_create_product(client):
      response = create_product(client)

      assert response.status_code == 201

      product = response.get_json()

      assert product["id"] is not None
      assert product["name"] == "Café"
      assert product["category"] == "Alimentos"
      assert product["price"] == "18.90"
      assert product["stock"] == 20


def test_list_products(client):
      created = create_product(client).get_json()

      response = client.get("/api/products/")

      assert response.status_code == 200

      products = response.get_json()["products"]

      assert len(products) == 1
      assert products[0]["id"] == created["id"]


def test_get_product_by_id(client):
      created = create_product(client).get_json()

      response = client.get(f"/api/products/{created['id']}")

      assert response.status_code == 200
      assert response.get_json()["name"] == "Café"


def test_get_nonexistent_product(client):
      response = client.get("/api/products/99999")

      assert response.status_code == 404
      assert response.get_json()["error"] == "Produto não encontrado."


def test_update_product(client):
      created = create_product(client).get_json()

      response = client.put(
          f"/api/products/{created['id']}",
          json={
              "name": "Café Premium",
              "category": "Alimentos",
              "price": "25.00",
              "stock": 15,
          },
      )

      assert response.status_code == 200

      product = response.get_json()

      assert product["name"] == "Café Premium"
      assert product["price"] == "25.00"
      assert product["stock"] == 15


def test_delete_product(client):
      created = create_product(client).get_json()

      response = client.delete(f"/api/products/{created['id']}")

      assert response.status_code == 204

      response = client.get(f"/api/products/{created['id']}")

      assert response.status_code == 404


@pytest.mark.parametrize(
      "payload",
      [
          {},
          {
              "category": "Alimentos",
              "price": "10.00",
              "stock": 1,
          },
          {
              "name": "Café",
              "price": "10.00",
              "stock": 1,
          },
          {
              "name": "Café",
              "category": "Alimentos",
              "price": "inválido",
              "stock": 1,
          },
          {
              "name": "Café",
              "category": "Alimentos",
              "price": "-1.00",
              "stock": 1,
          },
          {
              "name": "Café",
              "category": "Alimentos",
              "price": "10.00",
              "stock": -1,
          },
      ],
  )
def test_reject_invalid_product_data(client, payload):
      response = client.post("/api/products/", json=payload)

      assert response.status_code == 400

def test_patch_product_updates_only_informed_fields(client):
      created = create_product(client).get_json()

      response = client.patch(
          f"/api/products/{created['id']}",
          json={"price": "21.50", "stock": 8},
      )

      assert response.status_code == 200
      product = response.get_json()
      assert product == {
          **created,
          "price": "21.50",
          "stock": 8,
      }


@pytest.mark.parametrize(
      "payload",
      [
          {},
          {"unknown": "value"},
          {"stock": -1},
          {"name": "   "},
      ],
)
def test_reject_invalid_product_patch(client, payload):
      created = create_product(client).get_json()

      response = client.patch(
          f"/api/products/{created['id']}",
          json=payload,
      )

      assert response.status_code == 400


def test_patch_nonexistent_product(client):
      response = client.patch("/api/products/99999", json={"stock": 1})

      assert response.status_code == 404


@pytest.mark.parametrize(
      "field",
      ["name", "category"],
)
def test_reject_product_fields_over_database_limit(client, field):
      payload = {
          "name": "Café",
          "category": "Alimentos",
          "price": "18.90",
          "stock": 20,
      }
      payload[field] = "x" * 101

      response = client.post("/api/products/", json=payload)

      assert response.status_code == 400