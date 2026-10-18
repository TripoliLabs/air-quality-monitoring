#!/usr/bin/env bash
# =============================================================================
# Tier 1: Daily Logical Backups (pg_dump)
# =============================================================================
# Generates logical, portable backups of PostgreSQL (relational) and TimescaleDB.
#
# NOTE: pg_dump provides logical schema and table dumps. It CANNOT perform
# Point-in-Time Recovery (PITR). For PITR, see backup-physical-wal.sh.
#
# Usage:
#   ./backup-logical.sh [BACKUP_DIR]
# =============================================================================

set -euo pipefail

BACKUP_DIR="${1:-/mnt/data/backups/logical}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
RETENTION_DAYS=7

mkdir -p "${BACKUP_DIR}"
chmod 0700 "${BACKUP_DIR}"

echo "=== Starting Daily Logical Backup at ${TIMESTAMP} ==="

ENV_FILE="/etc/aq/app.env"
if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

RELATIONAL_DUMP="${BACKUP_DIR}/relational_${TIMESTAMP}.dump"
TELEMETRY_DUMP="${BACKUP_DIR}/telemetry_${TIMESTAMP}.dump"

echo "1. Exporting Relational Database (PostgreSQL)..."
docker exec -e PGPASSWORD="${APP_DB_PASSWORD:-airquality}" aq-postgres \
  pg_dump -U "${APP_DB_USERNAME:-airquality}" -d "${APP_DB_NAME:-airquality}" -Fc -Z 6 \
  > "${RELATIONAL_DUMP}"

echo "   Created: ${RELATIONAL_DUMP} ($(du -h "${RELATIONAL_DUMP}" | cut -f1))"

echo "2. Exporting Telemetry Database (TimescaleDB)..."
docker exec -e PGPASSWORD="${TSDB_PASSWORD:-airquality}" aq-timescaledb \
  pg_dump -U "${TSDB_USERNAME:-airquality}" -d "${TSDB_NAME:-telemetry}" -Fc -Z 6 \
  > "${TELEMETRY_DUMP}"

echo "   Created: ${TELEMETRY_DUMP} ($(du -h "${TELEMETRY_DUMP}" | cut -f1))"

# 3. Off-box Object Storage Sync (if configured)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "3. Uploading logical dumps to off-site object storage (s3://${BACKUP_S3_BUCKET}/logical/)..."
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${RELATIONAL_DUMP}" "s3://${BACKUP_S3_BUCKET}/logical/$(basename "${RELATIONAL_DUMP}")"
    aws s3 cp "${TELEMETRY_DUMP}" "s3://${BACKUP_S3_BUCKET}/logical/$(basename "${TELEMETRY_DUMP}")"
    echo "   Upload completed successfully."
  elif command -v rclone >/dev/null 2>&1; then
    rclone copy "${RELATIONAL_DUMP}" "backup-s3:${BACKUP_S3_BUCKET}/logical/"
    rclone copy "${TELEMETRY_DUMP}" "backup-s3:${BACKUP_S3_BUCKET}/logical/"
    echo "   Rclone upload completed successfully."
  else
    echo "   Warning: Neither aws-cli nor rclone found. Skipping remote upload."
  fi
fi

# 4. Enforce local retention policy
echo "4. Pruning local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "*.dump" -mtime +"${RETENTION_DAYS}" -delete

echo "=== Logical Backup Finished Successfully ==="
