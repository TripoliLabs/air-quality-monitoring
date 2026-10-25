#!/usr/bin/env bash
# =============================================================================
# Automated Production Deployment Script with Health Gate & Rollback
# =============================================================================
# Usage:
#   ./deploy.sh <IMAGE_SHA> [COMPOSE_DIR]
# =============================================================================

set -euo pipefail

IMAGE_SHA="${1:?Error: IMAGE_SHA must be provided as first argument}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${2:-$(cd "${SCRIPT_DIR}/../compose" && pwd)}"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.prod.yml"
STATE_FILE="/etc/aq/current_image_sha"
MAX_HEALTH_ATTEMPTS=30
HEALTH_INTERVAL_SEC=3

echo "=== Starting Deployment for Image SHA: ${IMAGE_SHA} ==="

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Error: Compose file not found at ${COMPOSE_FILE}" >&2
  exit 1
fi

PREVIOUS_IMAGE_SHA=""
if [ -f "${STATE_FILE}" ]; then
  PREVIOUS_IMAGE_SHA=$(cat "${STATE_FILE}" || true)
fi

export IMAGE_SHA

rollback() {
  echo "::error::Deployment health gate failed! Initiating rollback..."
  if [ -n "${PREVIOUS_IMAGE_SHA}" ] && [ "${PREVIOUS_IMAGE_SHA}" != "${IMAGE_SHA}" ]; then
    echo "Rolling back to previous stable image: ${PREVIOUS_IMAGE_SHA}"
    export IMAGE_SHA="${PREVIOUS_IMAGE_SHA}"
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
    echo "Rollback to ${PREVIOUS_IMAGE_SHA} executed."
  else
    echo "No previous stable image recorded. Halting services in current state for inspection."
  fi
  docker compose -f "${COMPOSE_FILE}" logs --tail 100
  exit 1
}

trap rollback ERR

echo "1. Pulling immutable pre-built images from GHCR..."
docker compose -f "${COMPOSE_FILE}" pull

echo "2. Running database migrations..."
# Run one-shot migrate service
docker compose -f "${COMPOSE_FILE}" run --rm migrate

echo "3. Starting updated application stack..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "4. Executing Deployment Health Gate..."

wait_for_service() {
  local service_name="$1"
  local check_cmd="$2"
  echo "Checking ${service_name}..."
  for i in $(seq 1 "${MAX_HEALTH_ATTEMPTS}"); do
    if eval "${check_cmd}" >/dev/null 2>&1; then
      echo "  [OK] ${service_name} passed health check (attempt ${i})"
      return 0
    fi
    sleep "${HEALTH_INTERVAL_SEC}"
  done
  echo "  [FAIL] ${service_name} failed health check after ${MAX_HEALTH_ATTEMPTS} attempts"
  return 1
}

# Gate Checks
wait_for_service "PostgreSQL Database" \
  "docker exec aq-postgres pg_isready -U airquality -d airquality"

wait_for_service "TimescaleDB Telemetry Database" \
  "docker exec aq-timescaledb pg_isready -U airquality -d telemetry"

wait_for_service "Redis Cache/PubSub" \
  "docker exec aq-redis sh -c 'redis-cli -a \"\${REDIS_PASSWORD}\" ping | grep -q PONG'"

wait_for_service "Mosquitto Broker" \
  "docker exec aq-mqtt mosquitto_sub -t '\$SYS/broker/version' -C 1 -u chirpstack -P \"\${MQTT_CHIRPSTACK_PASSWORD}\""

wait_for_service "REST & WebSocket API (/health)" \
  "docker exec aq-api wget -qO- http://localhost:3000/health"

wait_for_service "Ingestion Pipeline (/health)" \
  "docker exec aq-ingestion wget -qO- http://localhost:3001/health"

wait_for_service "Web SPA Dashboard (/healthz)" \
  "docker exec aq-dashboard curl -fsS http://localhost/healthz"

echo "Disabling rollback trap..."
trap - ERR

# Record current successful deployment SHA
echo "${IMAGE_SHA}" > "${STATE_FILE}"
echo "=== Deployment for ${IMAGE_SHA} verified successfully! ==="
