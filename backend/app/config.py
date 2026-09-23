import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
LOCAL_DATABASE_URI = f"sqlite:///{BASE_DIR / 'store.db'}"

load_dotenv(BACKEND_DIR / ".env")


def environment_flag(name, default=False):
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


class ConfigurationError(RuntimeError):
    """Raised when the selected environment is not configured safely."""


class Config:
    INITIAL_ADMIN_NAME = os.getenv("INITIAL_ADMIN_NAME")
    INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL")
    INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD")
    CREATE_INITIAL_ADMIN = all(
        (INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD)
    )
    DEMO_RESET_ENABLED = environment_flag("DEMO_RESET_ENABLED")
    SECRET_KEY = os.getenv("SECRET_KEY") or "dev-key"
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or LOCAL_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_SECURE = True

    @classmethod
    def init_app(cls, app):
        """Apply configuration that must be evaluated at app creation time."""
        pass


class DevelopmentConfig(Config):
    DEBUG = True
    JWT_COOKIE_SECURE = False


class TestingConfig(Config):
    TESTING = True
    CREATE_INITIAL_ADMIN = False
    DEMO_RESET_ENABLED = False
    SECRET_KEY = "testing-secret-key-with-at-least-32-bytes"
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    JWT_SECRET_KEY = "testing-jwt-secret-key-with-at-least-32-bytes"
    JWT_COOKIE_SECURE = False


class ProductionConfig(Config):
    REQUIRED_ENVIRONMENT_VARIABLES = {
        "DATABASE_URL": "SQLALCHEMY_DATABASE_URI",
        "SECRET_KEY": "SECRET_KEY",
        "JWT_SECRET_KEY": "JWT_SECRET_KEY",
        "INITIAL_ADMIN_NAME": "INITIAL_ADMIN_NAME",
        "INITIAL_ADMIN_EMAIL": "INITIAL_ADMIN_EMAIL",
        "INITIAL_ADMIN_PASSWORD": "INITIAL_ADMIN_PASSWORD",
    }
    INSECURE_SECRET_VALUES = {"dev-key"}

    @classmethod
    def init_app(cls, app):
        required_variables = cls.REQUIRED_ENVIRONMENT_VARIABLES
        production_values = {
            config_key: os.getenv(environment_variable)
            for environment_variable, config_key in required_variables.items()
        }
        app.config.update(production_values)
        app.config["CREATE_INITIAL_ADMIN"] = True

        missing_variables = [
            environment_variable
            for environment_variable, config_key in required_variables.items()
            if not str(app.config.get(config_key) or "").strip()
        ]

        if missing_variables:
            raise ConfigurationError(
                "Configuração de produção inválida. "
                "Defina as variáveis de ambiente obrigatórias: "
                + ", ".join(missing_variables)
                + "."
            )

        insecure_variables = [
            environment_variable
            for environment_variable in ("SECRET_KEY", "JWT_SECRET_KEY")
            if app.config[environment_variable].strip().lower()
            in cls.INSECURE_SECRET_VALUES
        ]

        if insecure_variables:
            raise ConfigurationError(
                "Configuração de produção insegura. "
                "Não use 'dev-key' em: "
                + ", ".join(insecure_variables)
                + "."
            )


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
