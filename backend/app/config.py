import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent

load_dotenv(BACKEND_DIR / ".env")


class Config:
    CREATE_INITIAL_ADMIN = False
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'store.db'}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_SECURE = True


class DevelopmentConfig(Config):
    INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD")
    CREATE_INITIAL_ADMIN = bool(INITIAL_ADMIN_PASSWORD)
    INITIAL_ADMIN_NAME = "Administrador"
    INITIAL_ADMIN_EMAIL = "admin@admin.com"
    DEBUG = True
    JWT_COOKIE_SECURE = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    JWT_SECRET_KEY = "testing-jwt-secret-key-with-at-least-32-bytes"
    JWT_COOKIE_SECURE = False


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": Config,
}
