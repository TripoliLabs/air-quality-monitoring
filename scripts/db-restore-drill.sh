#!/usr/bin/env bash
# Usage: db-restore-drill.sh relational.dump telemetry.dump
# Supply the adjacent .image and .sha256 files downloaded with a completed backup.
# Uses isolated disposable containers, never a production volume or network.
set -euo pipefail
RELATIONAL="${1:?Provide relational dump}"
TELEMETRY="${2:?Provide telemetry dump}"
DRILL_ID="aq-drill-$(date +%s)-$$"
containers=()
cleanup() {
  for container in "${containers[@]}"; do docker rm -fv "$container" >/dev/null 2>&1 || true; done
}
trap cleanup EXIT
for dump in "$RELATIONAL" "$TELEMETRY"; do
  test -s "$dump"
  test -s "$dump.image"
  (cd "$(dirname "$dump")" && sha256sum -c "$(basename "$dump").sha256")
done
for database in relational telemetry; do
  dump="$RELATIONAL"
  [[ "$database" == telemetry ]] && dump="$TELEMETRY"
  read -r image image_id username < "$dump.image"
  [[ "$username" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid backup role.' >&2; exit 1; }
  # Only official database repositories are accepted from backup metadata.
  if [[ "$database" == relational ]]; then
    [[ "$image" == postgres:* ]] || exit 1
  else
    [[ "$image" == timescale/timescaledb:* ]] || exit 1
  fi
  container="$DRILL_ID-$database"
  containers+=("$container")
  # Prefer the exact local image ID; after disaster recovery pull the recorded tag.
  if docker image inspect "$image_id" >/dev/null 2>&1; then image="$image_id"; fi
  docker run -d --network none --name "$container" \
    -e "POSTGRES_USER=$username" -e POSTGRES_PASSWORD=isolated-drill-only -e POSTGRES_DB=restore "$image" >/dev/null
  ready=false
  for ((attempt=0; attempt<60; attempt++)); do
    # TCP opens only after the image's temporary initialization server exits.
    if docker exec "$container" pg_isready -h 127.0.0.1 -U "$username" -d restore >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]] || { echo 'Restore database startup timed out.' >&2; exit 1; }
  if [[ "$database" == telemetry ]]; then
    docker exec "$container" psql -v ON_ERROR_STOP=1 -U "$username" -d restore \
      -c 'CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT timescaledb_pre_restore();'
  fi
  # No parallel restore: Timescale catalogs require a serial restore.
  docker exec -i "$container" pg_restore --exit-on-error --no-owner --no-privileges \
    -U "$username" -d restore < "$dump"
  if [[ "$database" == telemetry ]]; then
    docker exec "$container" psql -v ON_ERROR_STOP=1 -U "$username" -d restore \
      -c 'SELECT timescaledb_post_restore();' \
      -c 'SELECT count(*) AS restored_readings FROM readings;' \
      -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'readings') THEN RAISE EXCEPTION 'Missing readings hypertable'; END IF; END \$\$;" \
      -c 'SELECT * FROM readings_hourly LIMIT 1;'
  else
    docker exec "$container" psql -v ON_ERROR_STOP=1 -U "$username" -d restore \
      -c 'SELECT count(*) AS restored_sensors FROM sensors;'
  fi
  echo "$database restore and query checks passed."
done
echo 'Logical restore drill passed; disposable databases will be removed.'
