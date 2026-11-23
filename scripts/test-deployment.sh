#!/usr/bin/env bash
# Fault-injection regression tests: no Docker daemon or production resources needed.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin"
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\n' "${IMAGE_SHA:-}" "$*" >> "$AQ_ROOT/commands"
if [[ "$1" == inspect ]]; then
  case "$SCENARIO" in
    unhealthy|rollback_failure|first_failure)
      if [[ "$IMAGE_SHA" == "$NEW_SHA" || "$SCENARIO" == rollback_failure ]]; then echo unhealthy; exit 0; fi ;;
  esac
  echo healthy
  exit 0
fi
[[ "$1" == compose ]] || exit 0
shift 5 # compose --env-file FILE -f FILE
case "$1" in
  ps) echo "container-${*: -1}" ;;
  pull) [[ "$SCENARIO" != pull_failure ]] ;;
  run) [[ "$SCENARIO" != migration_failure ]] ;;
  up)
    [[ "$*" == 'up -d --no-deps api ingestion dashboard' ]] || exit 99
    [[ "$SCENARIO" != startup_failure || "$IMAGE_SHA" != "$NEW_SHA" ]] ;;
esac
MOCK
chmod +x "$work/bin/docker"
export PATH="$work/bin:$PATH"
export NEW_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OLD_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
export MAX_HEALTH_ATTEMPTS=1 HEALTH_INTERVAL_SEC=0
for SCENARIO in success pull_failure migration_failure startup_failure unhealthy rollback_failure first_failure; do
  export SCENARIO AQ_ROOT="$work/$SCENARIO"
  mkdir -p "$AQ_ROOT"
  touch "$AQ_ROOT/.env"
  ln -s "$REPO_ROOT/deploy" "$AQ_ROOT/deploy"
  if [[ "$SCENARIO" != first_failure ]]; then printf '%s\n' "$OLD_SHA" > "$AQ_ROOT/current_image_sha"; fi
  result=0
  bash "$AQ_ROOT/deploy/scripts/deploy.sh" "$NEW_SHA" > "$AQ_ROOT/output" 2>&1 || result=$?
  if [[ "$SCENARIO" == success ]]; then
    [[ "$result" == 0 && $(cat "$AQ_ROOT/current_image_sha") == "$NEW_SHA" ]]
    [[ -L "$AQ_ROOT/deploy" ]]
    [[ -f "$AQ_ROOT/deploy/compose/docker-compose.prod.yml" ]]
  else
    [[ "$result" != 0 ]]
    if [[ "$SCENARIO" == first_failure ]]; then
      [[ ! -e "$AQ_ROOT/current_image_sha" ]]
    else
      [[ $(cat "$AQ_ROOT/current_image_sha") == "$OLD_SHA" ]]
    fi
    case "$SCENARIO" in
      pull_failure|migration_failure) if grep -q ' up ' "$AQ_ROOT/commands"; then exit 1; fi ;;
      startup_failure|unhealthy) grep -q 'Rolled back applications' "$AQ_ROOT/output" ;;
      rollback_failure) grep -q 'ROLLBACK FAILED' "$AQ_ROOT/output" ;;
    esac
  fi
  # No broad stack updates, dependency starts, or database rollback commands.
  if grep -E 'up .*--remove-orphans|down|run --rm migrate' "$AQ_ROOT/commands"; then exit 1; fi
  echo "PASS: $SCENARIO"
done
export AQ_ROOT="$work/locked"
mkdir -p "$AQ_ROOT"; touch "$AQ_ROOT/.env"
exec 8>"$AQ_ROOT/deploy.lock"
flock -n 8
if bash "$REPO_ROOT/deploy/scripts/deploy.sh" "$NEW_SHA" > "$AQ_ROOT/output" 2>&1; then exit 1; fi
grep -q 'Another deployment is running' "$AQ_ROOT/output"
[[ ! -e "$AQ_ROOT/commands" ]]
echo 'PASS: concurrent deployment rejected'
if bash "$REPO_ROOT/deploy/scripts/deploy.sh" 'main; echo unsafe' >/dev/null 2>&1; then exit 1; fi
echo 'PASS: invalid SHA rejected'

# Backup failures must never claim a completed pair or prune the last good dump.
cat > "$work/bin/aws" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$AQ_ROOT/uploads"
[[ "$SCENARIO" != upload_failure ]]
MOCK
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
case "$1" in
  exec) [[ "$SCENARIO" != dump_failure ]] || exit 1; printf 'fixture dump\n' ;;
  inspect) printf 'postgres:18-alpine sha256:fixture\n' ;;
esac
MOCK
chmod +x "$work/bin/aws" "$work/bin/docker"
for SCENARIO in success missing_config dump_failure upload_failure; do
  export SCENARIO AQ_ROOT="$work/backup-$SCENARIO"
  backup_dir="$AQ_ROOT/backups"
  mkdir -p "$backup_dir"
  cat > "$AQ_ROOT/.env" <<'ENV'
APP_DB_USERNAME=airquality
APP_DB_NAME=airquality
TSDB_USERNAME=airquality
TSDB_NAME=telemetry
BACKUP_S3_BUCKET=test-bucket
BACKUP_S3_ENDPOINT=https://storage.example.test
AWS_ACCESS_KEY_ID=test-key
AWS_SECRET_ACCESS_KEY=test-secret
ENV
  if [[ "$SCENARIO" == missing_config ]]; then sed -i '/BACKUP_S3_BUCKET/d' "$AQ_ROOT/.env"; fi
  touch -d '2000-01-01' "$backup_dir/previous.dump"
  result=0
  bash "$REPO_ROOT/deploy/backups/backup-logical.sh" "$backup_dir" > "$AQ_ROOT/output" 2>&1 || result=$?
  if [[ "$SCENARIO" == success ]]; then
    [[ "$result" == 0 && $(wc -l < "$AQ_ROOT/uploads") == 7 ]]
    [[ ! -f "$backup_dir/previous.dump" ]]
    grep -q 'exit=0' "$backup_dir/last-run.status"
    grep -q '.complete' "$AQ_ROOT/uploads"
  else
    [[ "$result" != 0 && -f "$backup_dir/previous.dump" ]]
    if grep -q 'exit=0' "$backup_dir/last-run.status"; then exit 1; fi
    if [[ -e "$AQ_ROOT/uploads" ]] && grep -q '.complete' "$AQ_ROOT/uploads"; then exit 1; fi
  fi
  echo "PASS: backup $SCENARIO"
done
