#!/bin/sh
set -eu

python -m flask --app run db upgrade

demo_reset_enabled="${DEMO_RESET_ENABLED:-false}"
demo_reset_interval="${DEMO_RESET_INTERVAL_SECONDS:-0}"

case "$demo_reset_interval" in
    ''|*[!0-9]*)
        echo "DEMO_RESET_INTERVAL_SECONDS must be a non-negative integer." >&2
        exit 1
        ;;
esac

case "$demo_reset_enabled" in
    1|true|TRUE|yes|YES|on|ON)
        if [ "$demo_reset_interval" -gt 0 ] && [ "$demo_reset_interval" -lt 300 ]; then
            echo "DEMO_RESET_INTERVAL_SECONDS must be at least 300." >&2
            exit 1
        fi

        if [ "$demo_reset_interval" -gt 0 ]; then
            echo "Automatic demo reset enabled every ${demo_reset_interval} seconds."
            (
                while sleep "$demo_reset_interval"; do
                    echo "Starting scheduled demo reset."
                    python -m flask --app run reset-demo --yes || \
                        echo "Scheduled demo reset failed; it will be retried." >&2
                done
            ) &
        fi
        ;;
esac

exec gunicorn --bind "0.0.0.0:${PORT:-8000}" run:app
