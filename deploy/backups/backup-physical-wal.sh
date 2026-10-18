#!/usr/bin/env bash
# =============================================================================
# Tier 2: Physical Base Backups + Continuous WAL Archiving (True PITR)
# =============================================================================
# Executes a physical base backup via pg_basebackup with WAL inclusion.
# Continuous WAL segments are archived for replay to any specific recovery timestamp.
#
# Prerequisite:
# PostgreSQL / TimescaleDB postgresql.conf settings:
#   wal_level = replica
#   archive_mode = on
#   archive_command = 'test ! -f /mnt/data/backups/physical/wal/%f && cp %p /mnt/data/backups/physical/wal/%f'
#
# Usage:
#   ./backup-physical-wal.sh [BACKUP_DIR]
# =============================================================================

set -euo pipefail

BACKUP_ROOT="${1:-/mnt/data/backups/physical}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BASE_DIR="${BACKUP_ROOT}/base"
WAL_DIR="${BACKUP_ROOT}/wal"
RETENTION_DAYS=14

mkdir -p "${BASE_DIR}" "${WAL_DIR}"
chmod 0700 "${BACKUP_ROOT}" "${BASE_DIR}" "${WAL_DIR}"

echo "=== Starting Physical Base Backup & WAL Sync at ${TIMESTAMP} ==="

ENV_FILE="/etc/aq/app.env"
if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

# 1. Base backup for Relational PostgreSQL
echo "1. Creating physical base backup for Relational Database..."
RELATIONAL_TAR="${BASE_DIR}/relational_base_${TIMESTAMP}.tar.gz"
docker exec -e PGPASSWORD="${APP_DB_PASSWORD:-airquality}" aq-postgres \
  pg_basebackup -U "${APP_DB_USERNAME:-airquality}" -D - -Ft -z -X fetch \
  > "${RELATIONAL_TAR}"
echo "   Created: ${RELATIONAL_TAR} ($(du -h "${RELATIONAL_TAR}" | cut -f1))"

# 2. Base backup for TimescaleDB
echo "2. Creating physical base backup for TimescaleDB..."
TSDB_TAR="${BASE_DIR}/timescale_base_${TIMESTAMP}.tar.gz"
docker exec -e PGPASSWORD="${TSDB_PASSWORD:-airquality}" aq-timescaledb \
  pg_basebackup -U "${TSDB_USERNAME:-airquality}" -D - -Ft -z -X fetch \
  > "${TSDB_TAR}"
echo "   Created: ${TSDB_TAR} ($(du -h "${TSDB_TAR}" | cut -f1))"

# 3. Off-site sync to S3
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "3. Syncing base backups and WAL archive to off-site object storage..."
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${RELATIONAL_TAR}" "s3://${BACKUP_S3_BUCKET}/base/$(basename "${RELATIONAL_TAR}")"
    aws s3 cp "${TSDB_TAR}" "s3://${BACKUP_S3_BUCKET}/base/$(basename "${TSDB_TAR}")"
    aws s3 sync "${WAL_DIR}" "s3://${BACKUP_S3_BUCKET}/wal/"
    echo "   S3 sync completed."
  elif command -v rclone >/dev/null 2>&1; then
    rclone copy "${RELATIONAL_TAR}" "backup-s3:${BACKUP_S3_BUCKET}/base/"
    rclone copy "${TSDB_TAR}" "backup-s3:${BACKUP_S3_BUCKET}/base/"
    rclone sync "${WAL_DIR}" "backup-s3:${BACKUP_S3_BUCKET}/wal/"
    echo "   Rclone sync completed."
  fi
fi

# 4. Prune old base backups
echo "4. Pruning physical base backups older than ${RETENTION_DAYS} days..."
find "${BASE_DIR}" -type f -name "*_base_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "=== Physical Base Backup Completed Successfully ==="
