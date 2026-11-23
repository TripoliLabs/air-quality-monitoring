#!/usr/bin/env bash
# Usage: GHCR_USER=user deploy.sh <full-commit-sha> [compose-dir]
# Optional GHCR token on stdin; no token is needed for public images.
set -euo pipefail
umask 077
IMAGE_SHA="${1:?Usage: deploy.sh <full-commit-sha> [compose-dir]}"
[[ "$IMAGE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full lowercase commit SHA.' >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
COMPOSE_DIR="${2:-$SCRIPT_DIR/../compose}"
# Resolve the current-release symlink before replacing it on success.
COMPOSE_DIR="$(cd "$COMPOSE_DIR" && pwd -P)"
AQ_ROOT="${AQ_ROOT:-/opt/aq}"
ENV_FILE="$AQ_ROOT/.env"
STATE_FILE="$AQ_ROOT/current_image_sha"
MAX_HEALTH_ATTEMPTS="${MAX_HEALTH_ATTEMPTS:-30}"
HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-3}"
export IMAGE_SHA ENV_FILE
test -r "$ENV_FILE"
if [[ -e "$AQ_ROOT/deploy" && ! -L "$AQ_ROOT/deploy" ]]; then
  echo "$AQ_ROOT/deploy must be a symlink to retained release assets; see the runbook." >&2
  exit 1
fi
exec 9>"$AQ_ROOT/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
if [[ -n "${GHCR_USER:-}" ]]; then
  docker login ghcr.io --username "$GHCR_USER" --password-stdin
fi
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_DIR/docker-compose.prod.yml" "$@"
}
wait_for_apps() {
  local attempt service container healthy
  for ((attempt=1; attempt<=MAX_HEALTH_ATTEMPTS; attempt++)); do
    healthy=true
    for service in api ingestion dashboard; do
      container=$(compose ps -q "$service") || return 1
      if [[ -z "$container" ]] || [[ $(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null) != healthy ]]; then
        healthy=false
      fi
    done
    if [[ "$healthy" == true ]]; then return 0; fi
    sleep "$HEALTH_INTERVAL_SEC"
  done
  return 1
}
previous_sha=''
if [[ -f "$STATE_FILE" ]]; then
  previous_sha=$(cat "$STATE_FILE")
  [[ "$previous_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid saved deployment SHA.' >&2; exit 1; }
fi
# Fail before touching applications if stores, images, configuration or migrations fail.
compose config --quiet
for service in postgres timescaledb redis mqtt chirpstack; do
  test -n "$(compose ps --status running -q "$service")" || {
    echo "Backing service $service is not running; follow the initial setup runbook." >&2
    exit 1
  }
done
compose pull api ingestion dashboard migrate
compose run --rm --no-deps migrate
if compose up -d --no-deps api ingestion dashboard && wait_for_apps; then
  printf '%s\n' "$IMAGE_SHA" > "$STATE_FILE.tmp"
  mv -f "$STATE_FILE.tmp" "$STATE_FILE"
  printf '%s\n' "$COMPOSE_DIR" > "$AQ_ROOT/current_compose_dir.tmp"
  mv -f "$AQ_ROOT/current_compose_dir.tmp" "$AQ_ROOT/current_compose_dir"
  ln -sfn "$(dirname "$COMPOSE_DIR")" "$AQ_ROOT/deploy.next"
  mv -Tf "$AQ_ROOT/deploy.next" "$AQ_ROOT/deploy"
  echo "Deployment $IMAGE_SHA is healthy."
else
  echo 'Application deployment failed.' >&2
  compose logs --tail 100 api ingestion dashboard || true
  if [[ -n "$previous_sha" && "$previous_sha" != "$IMAGE_SHA" ]]; then
    export IMAGE_SHA="$previous_sha"
    if [[ -f "$AQ_ROOT/current_compose_dir" ]]; then
      COMPOSE_DIR=$(cat "$AQ_ROOT/current_compose_dir")
    fi
    if compose pull api ingestion dashboard && compose up -d --no-deps api ingestion dashboard && wait_for_apps; then
      echo "Rolled back applications to $previous_sha; database migrations were not reversed." >&2
    else
      echo 'ROLLBACK FAILED: operator intervention required.' >&2
    fi
  else
    echo 'No different successful release exists; leaving containers for inspection.' >&2
  fi
  exit 1
fi
