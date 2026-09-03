from datetime import datetime

import pytest

from app.database.db import db
from app.models.sale import Sale
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


def create_sale(client, product_id, **overrides):
      seller = Seller.query.first()
      if seller is None:
          seller = create_seller()

      payload = {
          "seller_id": seller.id,
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


def test_reject_duplicate_product_in_sale(client):
      seller = create_seller()
      product = create_product(client)
      item = {"product_id": product["id"], "quantity": 1}

      response = client.post(
          "/api/sales/",
          json={
              "seller_id": seller.id,
              "payment_method": "cash",
              "items": [item, item],
          },
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


def test_list_sales_filters_by_brazilian_date_seller_and_payment(client):
    ana = create_seller()
    bia = Seller(
        name="Bia Souza",
        seller_number=205,
        email="bia@example.com",
        active=True,
    )
    db.session.add(bia)
    db.session.commit()

    product = create_product(client, price="10.50", stock=10)
    august_sale = create_sale(
        client,
        product["id"],
        seller_id=ana.id,
        payment_method="cash",
    ).get_json()
    ana_sale = create_sale(
        client,
        product["id"],
        seller_id=ana.id,
        payment_method="pix",
    ).get_json()
    bia_sale = create_sale(
        client,
        product["id"],
        seller_id=bia.id,
        payment_method="pix",
    ).get_json()

    # UTC instants around midnight in Sao Paulo. The first sale belongs to
    # 31/08 locally, even though its UTC date is already 01/09.
    db.session.get(Sale, august_sale["id"]).created_at = datetime(2026, 9, 1, 2, 30)
    db.session.get(Sale, ana_sale["id"]).created_at = datetime(2026, 9, 1, 3, 30)
    db.session.get(Sale, bia_sale["id"]).created_at = datetime(2026, 9, 1, 13, 0)
    bia.active = False
    db.session.commit()

    response = client.get(
        "/api/sales/",
        query_string={
            "date_from": "2026-09-01",
            "date_to": "2026-09-01",
            "seller": "Bia",
            "payment_method": "pix",
        },
    )

    assert response.status_code == 200
    result = response.get_json()
    assert [sale["id"] for sale in result["sales"]] == [bia_sale["id"]]
    assert result["sales"][0]["created_at"].endswith("Z")
    assert result["summary"] == {
        "sales_count": 1,
        "total_amount": "10.50",
    }

    seller_number_response = client.get(
        "/api/sales/",
        query_string={"seller": "205"},
    )
    assert [sale["id"] for sale in seller_number_response.get_json()["sales"]] == [
        bia_sale["id"]
    ]

    sellers_response = client.get("/api/sales/filter-sellers")
    assert sellers_response.status_code == 200
    assert sellers_response.get_json()["sellers"] == [
        {
            "id": ana.id,
            "seller_number": 102,
            "name": "Ana",
            "active": True,
        },
        {
            "id": bia.id,
            "seller_number": 205,
            "name": "Bia Souza",
            "active": False,
        },
    ]


def test_list_sales_paginates_newest_first_and_summarizes_full_result(client):
    product = create_product(client, price="10.50", stock=10)
    sale_ids = [
        create_sale(client, product["id"]).get_json()["id"]
        for _ in range(3)
    ]

    for day, sale_id in enumerate(sale_ids, start=1):
        db.session.get(Sale, sale_id).created_at = datetime(2026, 8, day, 15, 0)
    db.session.commit()

    unpaginated_result = client.get("/api/sales/").get_json()
    first_page = client.get(
        "/api/sales/",
        query_string={"page": 1, "per_page": 2},
    ).get_json()
    second_page = client.get(
        "/api/sales/",
        query_string={"page": 2, "per_page": 2},
    ).get_json()

    assert [sale["id"] for sale in unpaginated_result["sales"]] == list(
        reversed(sale_ids)
    )
    assert unpaginated_result["pagination"]["per_page"] == 3
    assert [sale["id"] for sale in first_page["sales"]] == list(reversed(sale_ids[1:]))
    assert [sale["id"] for sale in second_page["sales"]] == [sale_ids[0]]
    assert first_page["pagination"] == {
        "page": 1,
        "per_page": 2,
        "total": 3,
        "total_pages": 2,
    }
    assert first_page["summary"] == {
        "sales_count": 3,
        "total_amount": "31.50",
    }


def test_credit_card_filter_includes_legacy_card_sales(client):
    seller = create_seller()
    product = create_product(client)
    sale = create_sale(
        client,
        product["id"],
        seller_id=seller.id,
        payment_method="cash",
    ).get_json()

    stored_sale = db.session.get(Sale, sale["id"])
    stored_sale.payment_method = "card"
    db.session.commit()

    response = client.get(
        "/api/sales/",
        query_string={"payment_method": "credit_card"},
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["summary"]["sales_count"] == 1
    assert result["sales"][0]["payment_method"] == "credit_card"


@pytest.mark.parametrize(
    ("query_string", "expected_error"),
    [
        ({"page": "zero"}, "O parâmetro 'page' deve ser um inteiro positivo."),
        ({"per_page": 101}, "O parâmetro 'per_page' deve ser um inteiro positivo de até 100."),
        ({"date_from": "01/09/2026"}, "O parâmetro 'date_from' deve usar o formato AAAA-MM-DD."),
        (
            {"date_from": "2026-09-02", "date_to": "2026-09-01"},
            "A data inicial não pode ser posterior à data final.",
        ),
        ({"seller_id": "abc"}, "O parâmetro 'seller_id' deve ser um inteiro positivo."),
    ],
)
def test_list_sales_rejects_invalid_filters(client, query_string, expected_error):
    response = client.get("/api/sales/", query_string=query_string)

    assert response.status_code == 400
    assert response.get_json() == {"error": expected_error}


def test_sale_details_keep_recorded_prices_after_product_price_changes(client):
    product = create_product(client, price="10.50", stock=10)
    sale = create_sale(client, product["id"]).get_json()

    update_response = client.patch(
        f"/api/products/{product['id']}",
        json={"price": "25.00"},
    )
    detail_response = client.get(f"/api/sales/{sale['id']}")

    assert update_response.status_code == 200
    assert detail_response.status_code == 200
    assert detail_response.get_json()["items"][0]["unit_price"] == "10.50"
    assert detail_response.get_json()["items"][0]["subtotal"] == "10.50"
