from datetime import datetime
from decimal import Decimal

import pytest

from app.database.db import db
from app.models.sale import Sale
from app.models.seller import Seller


def create_seller(*, name, number, email):
    seller = Seller(
        name=name,
        seller_number=number,
        email=email,
        active=True,
    )
    db.session.add(seller)
    db.session.commit()
    return seller


def create_product(client, *, name, price, stock=20):
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


def create_sale(client, *, seller_id, payment_method, items):
    response = client.post(
        "/api/sales/",
        json={
            "seller_id": seller_id,
            "payment_method": payment_method,
            "items": items,
        },
    )
    assert response.status_code == 201
    return response.get_json()


def set_sale_date(sale_id, value):
    db.session.get(Sale, sale_id).created_at = value
    db.session.commit()


def create_dashboard_scenario(client):
    ana = create_seller(
        name="Ana Lima",
        number=102,
        email="ana@example.com",
    )
    bia = create_seller(
        name="Bia Souza",
        number=205,
        email="bia@example.com",
    )
    coffee = create_product(client, name="Café", price="10.00")
    cake = create_product(client, name="Bolo", price="5.00")

    excluded_sale = create_sale(
        client,
        seller_id=ana.id,
        payment_method="debit_card",
        items=[{"product_id": coffee["id"], "quantity": 1}],
    )
    ana_sale = create_sale(
        client,
        seller_id=ana.id,
        payment_method="pix",
        items=[{"product_id": coffee["id"], "quantity": 2}],
    )
    bia_cash_sale = create_sale(
        client,
        seller_id=bia.id,
        payment_method="cash",
        items=[
            {"product_id": coffee["id"], "quantity": 1},
            {"product_id": cake["id"], "quantity": 2},
        ],
    )
    bia_credit_sale = create_sale(
        client,
        seller_id=bia.id,
        payment_method="credit_card",
        items=[{"product_id": cake["id"], "quantity": 1}],
    )

    set_sale_date(excluded_sale["id"], datetime(2026, 8, 31, 13, 0))
    set_sale_date(ana_sale["id"], datetime(2026, 9, 1, 13, 0))
    set_sale_date(bia_cash_sale["id"], datetime(2026, 9, 2, 12, 0))
    set_sale_date(bia_credit_sale["id"], datetime(2026, 9, 2, 14, 0))

    bia.active = False
    db.session.commit()

    return {
        "ana": ana,
        "bia": bia,
        "coffee": coffee,
        "cake": cake,
        "ana_sale": ana_sale,
        "bia_cash_sale": bia_cash_sale,
        "bia_credit_sale": bia_credit_sale,
    }


def test_dashboard_aggregates_all_sections_and_matches_history(client):
    scenario = create_dashboard_scenario(client)
    query = {"date_from": "2026-09-01", "date_to": "2026-09-07"}

    response = client.get("/api/dashboard/", query_string=query)
    history_response = client.get(
        "/api/sales/",
        query_string={**query, "page": 1, "per_page": 2},
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["period"] == query
    assert result["summary"] == {
        "total_amount": "45.00",
        "sales_count": 3,
        "average_ticket": "15.00",
        "units_sold": 6,
    }
    assert history_response.get_json()["summary"] == {
        "total_amount": result["summary"]["total_amount"],
        "sales_count": result["summary"]["sales_count"],
    }

    assert result["evolution"]["grouping"] == "day"
    assert len(result["evolution"]["points"]) == 7
    assert [point["total"] for point in result["evolution"]["points"]] == [
        "20.00",
        "25.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
    ]

    payments = {payment["method"]: payment for payment in result["payments"]}
    assert payments["cash"]["total"] == "20.00"
    assert payments["credit_card"]["total"] == "5.00"
    assert payments["debit_card"]["total"] == "0.00"
    assert payments["pix"]["total"] == "20.00"
    assert payments["pix"]["percentage"] == 44.4

    assert result["top_products"] == [
        {
            "product_id": scenario["coffee"]["id"],
            "name": "Café",
            "units_sold": 3,
            "total_amount": "30.00",
        },
        {
            "product_id": scenario["cake"]["id"],
            "name": "Bolo",
            "units_sold": 3,
            "total_amount": "15.00",
        },
    ]
    assert result["seller_performance"] == [
        {
            "seller_id": scenario["bia"].id,
            "seller_number": 205,
            "name": "Bia Souza",
            "active": False,
            "sales_count": 2,
            "total_amount": "25.00",
        },
        {
            "seller_id": scenario["ana"].id,
            "seller_number": 102,
            "name": "Ana Lima",
            "active": True,
            "sales_count": 1,
            "total_amount": "20.00",
        },
    ]
    assert [sale["id"] for sale in result["recent_sales"]] == [
        scenario["bia_credit_sale"]["id"],
        scenario["bia_cash_sale"]["id"],
        scenario["ana_sale"]["id"],
    ]
    assert result["recent_sales"][0]["items"][0]["unit_price"] == "5.00"


def test_dashboard_combines_date_and_inactive_seller_filters(client):
    create_dashboard_scenario(client)

    response = client.get(
        "/api/dashboard/",
        query_string={
            "date_from": "2026-09-01",
            "date_to": "2026-09-07",
            "seller": "205",
        },
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["summary"] == {
        "total_amount": "25.00",
        "sales_count": 2,
        "average_ticket": "12.50",
        "units_sold": 4,
    }
    assert [seller["name"] for seller in result["seller_performance"]] == [
        "Bia Souza"
    ]
    assert all(not seller["active"] for seller in result["seller_performance"])


def test_dashboard_groups_legacy_card_sales_as_credit_card(client):
    scenario = create_dashboard_scenario(client)
    stored_sale = db.session.get(Sale, scenario["bia_credit_sale"]["id"])
    stored_sale.payment_method = "card"
    db.session.commit()

    response = client.get(
        "/api/dashboard/",
        query_string={"date_from": "2026-09-01", "date_to": "2026-09-07"},
    )

    assert response.status_code == 200
    result = response.get_json()
    payments = {payment["method"]: payment for payment in result["payments"]}
    assert payments["credit_card"]["total"] == "5.00"
    assert payments["credit_card"]["sales_count"] == 1
    assert sum(
        Decimal(payment["total"]) for payment in result["payments"]
    ) == Decimal("45.00")
    assert result["recent_sales"][0]["payment_method"] == "credit_card"


def test_dashboard_returns_zeroes_and_hour_buckets_without_sales(client):
    response = client.get(
        "/api/dashboard/",
        query_string={"date_from": "2026-01-01", "date_to": "2026-01-01"},
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["summary"] == {
        "total_amount": "0.00",
        "sales_count": 0,
        "average_ticket": "0.00",
        "units_sold": 0,
    }
    assert result["evolution"]["grouping"] == "hour"
    assert len(result["evolution"]["points"]) == 24
    assert all(point["total"] == "0.00" for point in result["evolution"]["points"])
    assert all(payment["percentage"] == 0.0 for payment in result["payments"])
    assert result["top_products"] == []
    assert result["seller_performance"] == []
    assert result["recent_sales"] == []


@pytest.mark.parametrize(
    ("query", "message"),
    [
        (
            {"date_from": "01/09/2026"},
            "O parâmetro 'date_from' deve usar o formato AAAA-MM-DD.",
        ),
        (
            {"date_from": "2026-09-02", "date_to": "2026-09-01"},
            "A data inicial não pode ser posterior à data final.",
        ),
        (
            {"seller_id": "abc"},
            "O parâmetro 'seller_id' deve ser um inteiro positivo.",
        ),
    ],
)
def test_dashboard_rejects_invalid_filters(client, query, message):
    response = client.get("/api/dashboard/", query_string=query)

    assert response.status_code == 400
    assert response.get_json() == {"error": message}
