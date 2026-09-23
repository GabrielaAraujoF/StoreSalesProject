# StoreSales backend

## Public demo reset

The public demo keeps its SQLite database on the Railway volume and accepts
normal writes. The `reset-demo` Flask CLI command removes only application data
and recreates the original fixture through the same implementation used by
`seed-demo`. It does not drop tables or alter Alembic migrations.

The command is disabled by default, is not exposed by an HTTP route, and refuses
to run against a non-SQLite database. Configure these variables on the Railway
backend service:

```env
DEMO_RESET_ENABLED=true
DEMO_RESET_INTERVAL_SECONDS=0
```

Keep the SQLite file on a persistent Railway volume, for example:

```env
DATABASE_URL=sqlite:////data/store.db
```

To run a manual reset inside the deployed service and its mounted volume:

```bash
railway ssh --service backend --environment production -- \
  python -m flask --app run reset-demo --yes
```

Omit `--yes` when running interactively if you want the destructive-operation
confirmation prompt.

## Automatic interval

Set `DEMO_RESET_INTERVAL_SECONDS` to the desired interval, such as `3600` for
one hour, and keep `DEMO_RESET_ENABLED=true`. `start.sh` starts a lightweight
timer in the same service as Gunicorn, so it accesses the same mounted SQLite
file. The first reset happens only after the full interval; normal restarts do
not trigger a reset. Values between 1 and 299 seconds are rejected.

Set the interval to `0` to disable automatic resets while retaining the manual
command. Set `DEMO_RESET_ENABLED=false` to disable both modes.

Do not create a separate Railway Cron service for this SQLite setup: it would
run in another service container rather than against the web service's mounted
database file. If scheduling must be external, schedule an authenticated
`railway ssh` command that executes `reset-demo --yes` inside the running backend
service. Never expose the reset through a public HTTP endpoint.
