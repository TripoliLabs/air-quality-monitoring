#!/usr/bin/env bash
# =============================================================================
# Automated Point-in-Time Recovery (PITR) Restore Drill
# =============================================================================
# Simulates an accidental data disaster and verifies recovery to an exact timestamp
# using a physical base backup + replayed WAL archive logs.
#
# Runs in an isolated test container to ensure zero impact on running services.
# =============================================================================

set -euo pipefail

DRILL_ID="pitr_drill_$(date +%s)"
WORK_DIR="/tmp/${DRILL_ID}"
ARCHIVE_DIR="${WORK_DIR}/wal_archive"
BACKUP_DIR="${WORK_DIR}/base_backup"
RESTORE_DIR="${WORK_DIR}/restored_cluster"
CONTAINER_NAME="aq-drill-primary"
RESTORE_CONTAINER="aq-drill-restored"

echo "=== Starting Automated PITR Restore Drill (${DRILL_ID}) ==="

mkdir -p "${ARCHIVE_DIR}" "${BACKUP_DIR}" "${RESTORE_DIR}"
chmod 777 "${ARCHIVE_DIR}" "${WORK_DIR}"

cleanup() {
  echo "Cleaning up drill resources..."
  docker rm -f "${CONTAINER_NAME}" "${RESTORE_CONTAINER}" >/dev/null 2>&1 || true
  rm -rf "${WORK_DIR}" >/dev/null 2>&1 || true
  echo "Cleanup complete."
}
trap cleanup EXIT

echo "1. Starting temporary PostgreSQL instance with WAL archiving..."
docker run -d --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD=drillpass \
  -e POSTGRES_DB=drilldb \
  -v "${ARCHIVE_DIR}:/var/lib/postgresql/archive" \
  postgres:18-alpine \
  postgres \
    -c wal_level=replica \
    -c archive_mode=on \
    -c "archive_command=test ! -f /var/lib/postgresql/archive/%f && cp %p /var/lib/postgresql/archive/%f"

# Wait for primary to accept connections
for _ in $(seq 1 30); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "2. Initializing schema and baseline dataset..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d drilldb <<EOF
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  tx_time TIMESTAMPTZ DEFAULT clock_timestamp()
);
INSERT INTO transactions (description) VALUES ('Baseline transaction 0');
EOF

echo "3. Taking physical base backup via pg_basebackup..."
docker exec -e PGPASSWORD=drillpass "${CONTAINER_NAME}" \
  pg_basebackup -U postgres -D "/var/lib/postgresql/archive/base" -Ft -z -X fetch

cp -r "${ARCHIVE_DIR}/base/base.tar.gz" "${BACKUP_DIR}/"

echo "4. Inserting pre-incident valid transactions..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d drilldb <<EOF
INSERT INTO transactions (description) VALUES ('Valid transaction 1');
EOF

sleep 2
# Capture target recovery timestamp
TARGET_TIME=$(docker exec "${CONTAINER_NAME}" psql -U postgres -d drilldb -t -c "SELECT clock_timestamp();" | xargs)
echo "   Target recovery timestamp (T_target): ${TARGET_TIME}"
sleep 2

echo "5. Simulating accidental data loss / corruption incident..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d drilldb <<EOF
INSERT INTO transactions (description) VALUES ('MALICIOUS_CORRUPTED_ENTRY');
DROP TABLE transactions;
EOF

# Force WAL segment switch to archive all recent records
docker exec "${CONTAINER_NAME}" psql -U postgres -c "SELECT pg_switch_wal();" >/dev/null

echo "6. Extracting base backup into recovery cluster directory..."
tar -xzf "${BACKUP_DIR}/base.tar.gz" -C "${RESTORE_DIR}"
chmod 0700 "${RESTORE_DIR}"

# Configure Point-in-Time Recovery parameters in postgresql.conf and recovery.signal
touch "${RESTORE_DIR}/recovery.signal"

cat >> "${RESTORE_DIR}/postgresql.conf" <<EOF
restore_command = 'cp /var/lib/postgresql/archive/%f %p'
recovery_target_time = '${TARGET_TIME}'
recovery_target_action = 'promote'
EOF

echo "7. Starting recovery instance and replaying WAL to target time..."
docker run -d --name "${RESTORE_CONTAINER}" \
  -e POSTGRES_PASSWORD=drillpass \
  -v "${RESTORE_DIR}:/var/lib/postgresql/data" \
  -v "${ARCHIVE_DIR}:/var/lib/postgresql/archive:ro" \
  postgres:18-alpine

# Wait for recovery container to promote and become ready
for _ in $(seq 1 30); do
  if docker exec "${RESTORE_CONTAINER}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "8. Verifying restored state..."
# Check if table exists and contains valid transaction 1, but NOT the drop/corruption
RESTORED_ROWS=$(docker exec "${RESTORE_CONTAINER}" psql -U postgres -d drilldb -t -c "SELECT count(*) FROM transactions;" | xargs)
HAS_CORRUPTION=$(docker exec "${RESTORE_CONTAINER}" psql -U postgres -d drilldb -t -c "SELECT count(*) FROM transactions WHERE description = 'MALICIOUS_CORRUPTED_ENTRY';" | xargs || echo "0")

echo "   Restored row count: ${RESTORED_ROWS}"
echo "   Corrupted row count: ${HAS_CORRUPTION}"

if [ "${RESTORED_ROWS}" -ge 2 ] && [ "${HAS_CORRUPTION}" -eq 0 ]; then
  echo "=========================================================="
  echo ">>> PITR RESTORE DRILL: PASSED <<<"
  echo "Successfully recovered database to point in time: ${TARGET_TIME}"
  echo "Data corrupted after target time was cleanly discarded."
  echo "=========================================================="
  exit 0
else
  echo "=========================================================="
  echo ">>> PITR RESTORE DRILL: FAILED <<<"
  echo "Restored rows: ${RESTORED_ROWS}, Corrupted rows: ${HAS_CORRUPTION}"
  echo "=========================================================="
  exit 1
fi
