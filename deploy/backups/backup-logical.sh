#!/usr/bin/env bash
# Nightly logical backups. Configure S3-compatible storage in /opt/aq/.env.
set -euo pipefail
umask 077
AQ_ROOT="${AQ_ROOT:-/opt/aq}"
BACKUP_DIR="${1:-/mnt/data/backups/logical}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/backup.lock"
flock -n 9 || { echo 'Backup already running.' >&2; exit 1; }
status() {
  local code=$?
  printf '%s exit=%s\n' "$(date -u +%FT%TZ)" "$code" > "$BACKUP_DIR/last-run.status"
  [[ "$code" == 0 ]] || echo 'BACKUP FAILED: inspect aq-backup logs.' >&2
}
trap status EXIT
set -a
# shellcheck source=/dev/null
source "$AQ_ROOT/.env"
set +a
: "${BACKUP_S3_BUCKET:?Configure off-site backup bucket}"
: "${AWS_ACCESS_KEY_ID:?Configure S3 access key}"
: "${AWS_SECRET_ACCESS_KEY:?Configure S3 secret key}"
command -v aws >/dev/null
s3_options=()
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  [[ "$BACKUP_S3_ENDPOINT" == https://* ]] || { echo 'S3 endpoint must use HTTPS.' >&2; exit 1; }
  s3_options+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
fi
TIMESTAMP=$(date -u +%Y%m%d_%H%M%SZ)
for database in relational telemetry; do
  if [[ "$database" == relational ]]; then
    container=aq-postgres; username="$APP_DB_USERNAME"; dbname="$APP_DB_NAME"
  else
    container=aq-timescaledb; username="$TSDB_USERNAME"; dbname="$TSDB_NAME"
  fi
  dump="$BACKUP_DIR/${database}_${TIMESTAMP}.dump"
  # Local Unix socket inside each DB container; no password in arguments or output.
  docker exec "$container" pg_dump -U "$username" -d "$dbname" -Fc -Z 6 > "$dump.partial"
  mv "$dump.partial" "$dump"
  printf '%s %s\n' "$(docker inspect --format '{{.Config.Image}} {{.Image}}' "$container")" "$username" > "$dump.image"
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$dump")") > "$dump.sha256"
  for file in "$dump" "$dump.image" "$dump.sha256"; do
    aws "${s3_options[@]}" s3 cp "$file" "s3://$BACKUP_S3_BUCKET/logical/$(basename "$file")" --only-show-errors
  done
done
# A pair is usable off-site only after this completion marker is uploaded.
printf '%s\n' "$TIMESTAMP" > "$BACKUP_DIR/$TIMESTAMP.complete"
aws "${s3_options[@]}" s3 cp "$BACKUP_DIR/$TIMESTAMP.complete" \
  "s3://$BACKUP_S3_BUCKET/logical/$TIMESTAMP.complete" --only-show-errors
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.image' \
  -o -name '*.dump.sha256' -o -name '*.complete' -o -name '*.partial' \) -mtime +7 -delete
echo "Both databases backed up off-site: $TIMESTAMP"
