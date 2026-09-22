import pytest

from app import create_app
from app.config import ConfigurationError


PRODUCTION_ENVIRONMENT = {
    "DATABASE_URL": "sqlite:///:memory:",
    "SECRET_KEY": "production-secret-key-with-at-least-32-bytes",
    "JWT_SECRET_KEY": "production-jwt-secret-with-at-least-32-bytes",
    "INITIAL_ADMIN_NAME": "Administrador",
    "INITIAL_ADMIN_EMAIL": "admin@example.com",
    "INITIAL_ADMIN_PASSWORD": "production-admin-password",
}


def configure_production_environment(monkeypatch, **overrides):
    values = {**PRODUCTION_ENVIRONMENT, **overrides}

    for variable, value in values.items():
        if value is None:
            monkeypatch.delenv(variable, raising=False)
        else:
            monkeypatch.setenv(variable, value)


def test_production_requires_every_critical_environment_variable(monkeypatch):
    configure_production_environment(
        monkeypatch,
        DATABASE_URL=None,
        SECRET_KEY=None,
        JWT_SECRET_KEY=None,
        INITIAL_ADMIN_NAME=None,
        INITIAL_ADMIN_EMAIL=None,
        INITIAL_ADMIN_PASSWORD=None,
    )

    with pytest.raises(ConfigurationError) as raised_error:
        create_app("production")

    message = str(raised_error.value)
    assert "Configuração de produção inválida" in message

    for variable in PRODUCTION_ENVIRONMENT:
        assert variable in message


@pytest.mark.parametrize("variable", ["SECRET_KEY", "JWT_SECRET_KEY"])
def test_production_rejects_insecure_secret_values(monkeypatch, variable):
    configure_production_environment(monkeypatch, **{variable: "dev-key"})

    with pytest.raises(ConfigurationError, match="Não use 'dev-key'"):
        create_app("production")


def test_app_env_selects_valid_production_configuration(monkeypatch):
    configure_production_environment(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")

    app = create_app()

    assert app.config["APP_ENV"] == "production"
    assert app.config["SQLALCHEMY_DATABASE_URI"] == PRODUCTION_ENVIRONMENT[
        "DATABASE_URL"
    ]
    assert app.config["SECRET_KEY"] == PRODUCTION_ENVIRONMENT["SECRET_KEY"]
    assert app.config["JWT_SECRET_KEY"] == PRODUCTION_ENVIRONMENT["JWT_SECRET_KEY"]
    assert app.config["INITIAL_ADMIN_NAME"] == PRODUCTION_ENVIRONMENT[
        "INITIAL_ADMIN_NAME"
    ]
    assert app.config["INITIAL_ADMIN_EMAIL"] == PRODUCTION_ENVIRONMENT[
        "INITIAL_ADMIN_EMAIL"
    ]
    assert app.config["INITIAL_ADMIN_PASSWORD"] == PRODUCTION_ENVIRONMENT[
        "INITIAL_ADMIN_PASSWORD"
    ]
    assert app.config["CREATE_INITIAL_ADMIN"] is True


def test_invalid_app_env_fails_with_supported_values():
    with pytest.raises(ConfigurationError) as raised_error:
        create_app("staging")

    message = str(raised_error.value)
    assert 'APP_ENV inválido: "staging"' in message
    assert "development, testing, production" in message


def test_development_keeps_local_defaults_without_production_validation():
    app = create_app("development")

    assert app.config["APP_ENV"] == "development"
    assert app.config["DEBUG"] is True
    assert app.config["JWT_COOKIE_SECURE"] is False


def test_testing_configuration_is_isolated_from_initial_admin_environment(
    monkeypatch,
):
    configure_production_environment(monkeypatch)

    app = create_app("testing")

    assert app.config["TESTING"] is True
    assert app.config["CREATE_INITIAL_ADMIN"] is False
