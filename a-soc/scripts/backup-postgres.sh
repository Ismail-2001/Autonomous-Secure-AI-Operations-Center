#!/bin/bash
set -euo pipefail

# A-SOC Postgres Backup Script
# Usage: ./scripts/backup-postgres.sh [output-dir]

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/asoc_db_${TIMESTAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/asoc_db_latest.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-asoc_user}"
PGPASSWORD="${PGPASSWORD:-changeme123}"
PGDATABASE="${PGDATABASE:-asoc_db}"

export PGPASSWORD

echo "=== A-SOC Backup: $(date) ==="
echo "Backing up ${PGDATABASE}@${PGHOST}:${PGPORT} → ${BACKUP_FILE}"

pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

ln -sf "$BACKUP_FILE" "$LATEST_LINK"

BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
echo "Backup size: ${BACKUP_SIZE} bytes"

find "$BACKUP_DIR" -name "asoc_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Pruned backups older than ${RETENTION_DAYS} days"

echo "=== Backup Complete ==="
