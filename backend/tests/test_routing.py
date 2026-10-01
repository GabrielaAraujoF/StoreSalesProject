import pytest


@pytest.mark.parametrize(
    ("method", "path", "expected_status"),
    [
        ("get", "/api/products", 200),
        ("get", "/api/customers", 200),
        ("get", "/api/sales", 200),
        ("post", "/api/products", 400),
        ("post", "/api/customers", 400),
        ("post", "/api/sales", 400),
    ],
)
def test_collection_routes_accept_urls_without_trailing_slash(
    client,
    method,
    path,
    expected_status,
):
    response = getattr(client, method)(path, json={} if method == "post" else None)

    assert response.status_code == expected_status
    assert response.status_code not in {307, 308}
