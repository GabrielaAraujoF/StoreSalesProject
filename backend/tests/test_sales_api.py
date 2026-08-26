from app.database.db import db
from app.models.seller import Seller


def create_seller(*, active=True):
      seller = Seller(
          name="Ana",
          seller_number=102,
          email="ana@example.com",
          active=active,
      )
      db.session.add(seller)
      db.session.commit()
      return seller


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
      seller = create_seller()
      product = create_product(
          client,
          price="10.50",
          stock=10,
      )

      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
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
      assert sale["seller"] == {
          "id": seller.id,
          "seller_number": 102,
          "name": "Ana",
      }
      assert sale["total"] == "31.50"
      assert sale["items"][0]["unit_price"] == "10.50"
      assert sale["items"][0]["subtotal"] == "31.50"

      updated_product = get_product(client, product["id"])

      assert updated_product["stock"] == 7


def test_reject_sale_with_insufficient_stock(client):
      seller = create_seller()
      product = create_product(
          client,
          stock=2,
      )

      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
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
      seller = create_seller()
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
              "seller_id": seller.id,
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
      seller = create_seller()
      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
              "payment_method": "cash",
              "items": [],
          },
      )

      assert response.status_code == 400


def test_reject_sale_with_nonexistent_product(client):
      seller = create_seller()
      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
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


def test_reject_sale_without_seller(client):
      response = client.post(
          "/api/sales/",
          json={
              "payment_method": "cash",
              "items": [{"product_id": 1, "quantity": 1}],
          },
      )

      assert response.status_code == 400


def test_reject_sale_with_nonexistent_seller(client):
      response = client.post(
          "/api/sales/",
          json={
              "seller_id": 99999,
              "payment_method": "cash",
              "items": [{"product_id": 1, "quantity": 1}],
          },
      )

      assert response.status_code == 404
      assert response.get_json() == {"error": "Vendedor não encontrado."}


def test_reject_sale_with_inactive_seller(client):
      seller = create_seller(active=False)

      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
              "payment_method": "cash",
              "items": [{"product_id": 1, "quantity": 1}],
          },
      )

      assert response.status_code == 409
      assert response.get_json() == {"error": "Vendedor inativo."}
