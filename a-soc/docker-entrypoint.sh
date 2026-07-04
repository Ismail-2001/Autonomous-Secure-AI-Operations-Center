#!/bin/sh
set -e

if [ "$SKIP_MIGRATIONS" != "true" ] && [ -n "$DATABASE_URL" ]; then
    echo "Database migrations handled by connection.py at startup."
fi

mkdir -p /app/data || true

exec uvicorn asoc.api.app:app --host 0.0.0.0 --port 9002 --workers 2 --limit-concurrency 100
