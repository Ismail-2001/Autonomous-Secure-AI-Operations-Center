#!/bin/sh
set -e

if [ -n "$1" ]; then
    exec "$@"
fi

if [ "$SKIP_MIGRATIONS" != "true" ] && [ -n "$DATABASE_URL" ]; then
    echo "Applying canonical database migrations via Alembic..."
    alembic upgrade head || echo "Warning: Alembic migration check finished with status $?, proceeding..."
fi

mkdir -p /app/data || true

exec uvicorn asoc.api.app:app --host 0.0.0.0 --port 9002 --workers 2 --limit-concurrency 100
