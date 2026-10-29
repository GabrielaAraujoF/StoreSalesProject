# StoreSales | Sistema de Gestão de Vendas

Aplicação full stack para gerenciamento de produtos, clientes, vendedores e vendas. Desenvolvida como projeto de portfólio, com interface web e API REST.

**[Acessar demonstração](https://store-sales-project.vercel.app/)** · **[Repositório](https://github.com/GabrielaAraujoF/StoreSalesProject)**

## Funcionalidades

- Cadastro e gerenciamento de produtos, clientes e vendedores.
- Registro de vendas com múltiplos itens e formas de pagamento.
- Atualização de estoque após a venda e preservação do preço praticado.
- Histórico de vendas com filtros por período, vendedor e pagamento.
- Dashboard para acompanhamento das vendas.
- Autenticação administrativa e dados fictícios para demonstração.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Backend | Python, Flask, SQLAlchemy, API REST |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Banco de dados | SQLite |
| Testes e documentação | pytest, Swagger |
| Hospedagem | Vercel (frontend); Render (opção para o backend) |

## Estrutura do repositório


StoreSalesProject/
├── backend/       # API, modelos, migrações e testes
├── frontend/      # Interface web em Next.js
├── .gitignore
└── README.md
```

## Executar localmente

**Pré-requisitos:** Python, Node.js 24 e Git.

### 1. Backend (PowerShell)

```powershell
git clone https://github.com/GabrielaAraujoF/StoreSalesProject.git
cd StoreSalesProject/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Preencha no arquivo `backend/.env` as variáveis `SECRET_KEY`, `JWT_SECRET_KEY`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` com valores locais. Não publique o arquivo `.env`.

```powershell
flask --app run db upgrade
flask --app run create-admin
python run.py
```

API local: `http://localhost:5000`  
Documentação Swagger: `http://localhost:5000/api/docs`

### 2. Frontend (outro terminal, aberto na raiz do projeto)

```powershell
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:3000`. O frontend usa `http://localhost:5000` como backend no ambiente local, caso `BACKEND_URL` não esteja definida.

## Testes

Dentro da pasta `backend`, com o ambiente virtual ativo:

```powershell
pytest
```

## Deploy e demonstração

O frontend é publicado na **Vercel** e se comunica com a API Flask por meio da variável `BACKEND_URL`, que deve conter a URL HTTPS pública do backend na configuração do projeto da Vercel. A API pode ser hospedada separadamente no **Render**.

**Atenção:** a demonstração utiliza dados fictícios. Em hospedagens gratuitas sem disco persistente, o SQLite pode perder alterações em reinicializações ou novos deploys; não use esta configuração para armazenar dados reais.
