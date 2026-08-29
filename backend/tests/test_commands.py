from app.models.account import Account


def test_create_admin_command(app):
    runner = app.test_cli_runner()

    result = runner.invoke(
        args=[
            "create-admin",
            "--name",
            "Administrador",
            "--email",
            "ADMIN@example.com",
        ],
        input="senha-segura\nsenha-segura\n",
    )

    assert result.exit_code == 0
    assert 'Administrador "admin@example.com" criado com sucesso.' in result.output

    account = Account.query.one()
    assert account.name == "Administrador"
    assert account.email == "admin@example.com"
    assert account.role == "admin"
    assert account.active is True
    assert account.password_hash != "senha-segura"
    assert account.check_password("senha-segura") is True


def test_create_admin_command_rejects_duplicate_email(app, account_factory):
    account_factory()
    runner = app.test_cli_runner()

    result = runner.invoke(
        args=[
            "create-admin",
            "--name",
            "Outro administrador",
            "--email",
            "ADMIN@example.com",
        ],
    )

    assert result.exit_code == 1
    assert "Já existe uma conta com este e-mail." in result.output


def test_create_admin_command_rejects_short_password(app):
    runner = app.test_cli_runner()

    result = runner.invoke(
        args=[
            "create-admin",
            "--name",
            "Administrador",
            "--email",
            "admin@example.com",
        ],
        input="curta\ncurta\n",
    )

    assert result.exit_code == 1
    assert "A senha deve ter pelo menos 8 caracteres." in result.output
    assert Account.query.count() == 0
