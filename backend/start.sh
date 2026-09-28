#!/bin/sh
set -eu

python -m flask --app run:app db upgrade
python -m flask --app run:app seed-demo

exec gunicorn --bind "0.0.0.0:${PORT:-8000}" run:app
