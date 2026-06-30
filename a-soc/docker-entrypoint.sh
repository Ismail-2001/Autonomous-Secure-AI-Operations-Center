#!/bin/sh
set -e

if [ "$SKIP_MIGRATIONS" != "true" ] && [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    python -m alembic upgrade head
    echo "Migrations complete."
fi

exec uvicorn asoc.api.app:app --host 0.0.0.0 --port 9002 --workers 2 --limit-concurrency 100
