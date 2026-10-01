# StoreSales backend

## Public demo sellers

Production startup runs the migrations and then the idempotent `seed-demo`
command before Gunicorn. The command ensures that `Ana Demo`, the only public
demo seller, exists and does not create any other application data. The seed
restores her name and active status when necessary, while preserving the
database-generated seller number. It also removes the former `Carlos Demo`
record after assigning any of his existing sales to Ana.

The API exposes Ana as an optional default ID. `ProductionConfig` enables the
public demo mode, which uses her automatically for every new sale. Development
and testing environments keep the normal explicit seller-selection behavior.

```bash
python -m flask --app run:app db upgrade
python -m flask --app run:app seed-demo
gunicorn --bind "0.0.0.0:${PORT:-8000}" run:app
```

With `DATABASE_URL=sqlite:////data/store.db`, migrations, the seed command, and
the application all use the same SQLite file on the Railway volume. The seed
does not require any additional environment variables.

## Public demo reset

The public demo keeps its SQLite database on the Railway volume and accepts
normal writes. The `reset-demo` Flask CLI command removes only application data
and recreates the original complete fixture, including the public demo seller.
It does not drop tables or alter
Alembic migrations. This reset is separate from the non-destructive
`seed-demo` command used during startup.

The command is disabled by default, is not exposed by an HTTP route, and refuses
to run against a non-SQLite database. Configure these variables on the Railway
backend service:

```env
DEMO_RESET_ENABLED=true
```

Keep the SQLite file on a persistent Railway volume, for example:

```env
DATABASE_URL=sqlite:////data/store.db
```

To run a manual reset inside the deployed service and its mounted volume:

```bash
railway ssh --service backend --environment production -- \
  python -m flask --app run:app reset-demo --yes
```

Omit `--yes` when running interactively if you want the destructive-operation
confirmation prompt.

`start.sh` never schedules this reset. Do not create a separate Railway Cron
service for this SQLite setup: it would run in another service container rather
than against the web service's mounted database file. Use the authenticated
manual command above when a reset is intentionally required, and never expose
the reset through a public HTTP endpoint.
