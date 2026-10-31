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

PORT="${PORT:-9002}"
WORKERS="${WEB_CONCURRENCY:-2}"

echo "Starting A-SOC API service on port ${PORT} with ${WORKERS} workers..."
exec uvicorn src.asoc.api.app:app --host 0.0.0.0 --port "${PORT}" --workers "${WORKERS}" --limit-concurrency 100
