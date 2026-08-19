import pytest


def create_product(
      client,
      *,
      name="Café",
      price="10.50",
      stock=10,
  ):
      response = client.post(
          "/api/products/",
          json={
              "name": name,
              "category": "Alimentos",
              "price": price,
              "stock": stock,
          },
      )

      assert response.status_code == 201

      return response.get_json()


def get_product(client, product_id):
      response = client.get(f"/api/products/{product_id}")

      assert response.status_code == 200

      return response.get_json()


def test_sale_calculates_total_and_reduces_stock(client):
      product = create_product(
          client,
          price="10.50",
          stock=10,
      )

      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "cash",
              "items": [
                  {
                      "product_id": product["id"],
                      "quantity": 3,
                  }
              ],
          },
      )

      assert response.status_code == 201

      sale = response.get_json()

      assert sale["customer"] is None
      assert sale["total"] == "31.50"
      assert sale["items"][0]["unit_price"] == "10.50"
      assert sale["items"][0]["subtotal"] == "31.50"

      updated_product = get_product(client, product["id"])

      assert updated_product["stock"] == 7


def test_reject_sale_with_insufficient_stock(client):
      product = create_product(
          client,
          stock=2,
      )

      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "cash",
              "items": [
                  {
                      "product_id": product["id"],
                      "quantity": 3,
                  }
              ],
          },
      )

      assert response.status_code == 409
      assert response.get_json()["available_stock"] == 2

      unchanged_product = get_product(client, product["id"])

      assert unchanged_product["stock"] == 2


def test_sale_rolls_back_when_one_item_fails(client):
      available_product = create_product(
          client,
          name="Café",
          stock=10,
      )

      unavailable_product = create_product(
          client,
          name="Bolo",
          stock=1,
      )

      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "card",
              "items": [
                  {
                      "product_id": available_product["id"],
                      "quantity": 2,
                  },
                  {
                      "product_id": unavailable_product["id"],
                      "quantity": 5,
                  },
              ],
          },
      )

      assert response.status_code == 409

      first_product = get_product(
          client,
          available_product["id"],
      )

      second_product = get_product(
          client,
          unavailable_product["id"],
      )

      assert first_product["stock"] == 10
      assert second_product["stock"] == 1

      sales = client.get("/api/sales/").get_json()["sales"]

      assert sales == []


def test_reject_sale_without_items(client):
      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "cash",
              "items": [],
          },
      )

      assert response.status_code == 400


def test_reject_sale_with_nonexistent_product(client):
      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "cash",
              "items": [
                  {
                      "product_id": 99999,
                      "quantity": 1,
                  }
              ],
          },
      )

      assert response.status_code == 404


def create_sale(client, product_id, **overrides):
      payload = {
          "payment_method": "cash",
          "items": [{"product_id": product_id, "quantity": 1}],
      }
      payload.update(overrides)
      return client.post("/api/sales/", json=payload)


def test_list_and_get_sale(client):
      product = create_product(client)
      created = create_sale(client, product["id"]).get_json()

      list_response = client.get("/api/sales/")
      get_response = client.get(f"/api/sales/{created['id']}")

      assert list_response.status_code == 200
      assert list_response.get_json()["sales"] == [created]
      assert get_response.status_code == 200
      assert get_response.get_json() == created


def test_get_nonexistent_sale(client):
      response = client.get("/api/sales/99999")

      assert response.status_code == 404
      assert response.get_json()["error"] == "Venda não encontrada."


def test_create_sale_with_customer(client):
      customer = client.post(
          "/api/customers/",
          json={"name": "Gabriel", "phone": "11999999999"},
      ).get_json()
      product = create_product(client)

      response = create_sale(
          client,
          product["id"],
          customer_id=customer["id"],
      )

      assert response.status_code == 201
      assert response.get_json()["customer"] == customer


def test_reject_sale_with_nonexistent_customer(client):
      product = create_product(client)

      response = create_sale(
          client,
          product["id"],
          customer_id=99999,
      )

      assert response.status_code == 404
      assert response.get_json()["error"] == "Cliente não encontrado."
      assert get_product(client, product["id"])["stock"] == 10


@pytest.mark.parametrize(
      "payload",
      [
          None,
          {},
          {"payment_method": "", "items": [{}]},
          {"payment_method": "x" * 31, "items": [{}]},
          {"payment_method": "cash", "items": "invalid"},
          {"payment_method": "cash", "items": ["invalid"]},
          {
              "payment_method": "cash",
              "items": [{"product_id": True, "quantity": 1}],
          },
          {
              "payment_method": "cash",
              "items": [{"product_id": 1, "quantity": 0}],
          },
          {
              "customer_id": 0,
              "payment_method": "cash",
              "items": [{"product_id": 1, "quantity": 1}],
          },
      ],
  )
def test_reject_invalid_sale_data(client, payload):
      response = client.post("/api/sales/", json=payload)

      assert response.status_code == 400


def test_reject_duplicate_product_in_sale(client):
      product = create_product(client)
      item = {"product_id": product["id"], "quantity": 1}

      response = client.post(
          "/api/sales/",
          json={"payment_method": "cash", "items": [item, item]},
      )

      assert response.status_code == 400
      assert get_product(client, product["id"])["stock"] == 10


def test_reject_deleting_product_associated_with_sale(client):
      product = create_product(client)
      assert create_sale(client, product["id"]).status_code == 201

      response = client.delete(f"/api/products/{product['id']}")

      assert response.status_code == 409
      assert response.get_json()["error"] == (
          "Produto não pode ser excluído porque possui vendas associadas."
      )

def test_competing_sales_cannot_oversell_stock(client):
      product = create_product(client, stock=1)

      first_response = create_sale(client, product["id"])
      second_response = create_sale(client, product["id"])

      assert first_response.status_code == 201
      assert second_response.status_code == 409
      assert second_response.get_json()["available_stock"] == 0
      assert get_product(client, product["id"])["stock"] == 0
      assert len(client.get("/api/sales/").get_json()["sales"]) == 1


def test_deleting_customer_preserves_sale_without_customer(client):
      customer = client.post(
          "/api/customers/",
          json={"name": "Gabriel", "phone": "11999999999"},
      ).get_json()
      product = create_product(client)
      sale = create_sale(
          client,
          product["id"],
          customer_id=customer["id"],
      ).get_json()

      delete_response = client.delete(f"/api/customers/{customer['id']}")
      sale_response = client.get(f"/api/sales/{sale['id']}")

      assert delete_response.status_code == 204
      assert sale_response.status_code == 200
      assert sale_response.get_json()["customer"] is None