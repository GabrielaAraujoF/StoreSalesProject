DEFAULT_DEMO_SELLER_EMAIL = "ana.demo@storesales.local"

PUBLIC_DEMO_SELLERS = (
    {
        "name": "Ana Demo",
        "email": DEFAULT_DEMO_SELLER_EMAIL,
        "active": True,
    },
)

LEGACY_PUBLIC_DEMO_SELLER_EMAILS = (
    "carlos.demo@storesales.local",
)


def is_default_demo_seller(seller):
    """Identify the optional public-demo default without relying on database IDs."""
    return seller.email.casefold() == DEFAULT_DEMO_SELLER_EMAIL
