#!/usr/bin/env bash
# =============================================================================
# Production Secrets Initialization Script
# =============================================================================
# Sets up /etc/aq directory, generates cryptographically strong random passwords,
# provisions /etc/aq/app.env (mode 0600), and creates /etc/aq/mosquitto.passwd.
#
# Usage:
#   sudo ./setup-production-secrets.sh [domain] [acme_email]
# =============================================================================

set -euo pipefail

DOMAIN="${1:-aq.tripolilabs.org}"
ACME_EMAIL="${2:-admin@tripolilabs.org}"
CONFIG_DIR="/etc/aq"

echo "=== Initializing Production Secrets for ${DOMAIN} ==="

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root." >&2
  exit 1
fi

mkdir -p "${CONFIG_DIR}"
chmod 0700 "${CONFIG_DIR}"

APP_ENV_FILE="${CONFIG_DIR}/app.env"
MOSQUITTO_PASSWD_FILE="${CONFIG_DIR}/mosquitto.passwd"
MOSQUITTO_CONF_FILE="${CONFIG_DIR}/mosquitto.conf"

generate_secret() {
  openssl rand -hex 24
}

# Preserve existing passwords if app.env already exists, otherwise generate new ones
if [ -f "${APP_ENV_FILE}" ]; then
  echo "Existing ${APP_ENV_FILE} detected. Sourcing existing secrets..."
  # shellcheck disable=SC1090
  source "${APP_ENV_FILE}"
fi

APP_DB_PASSWORD="${APP_DB_PASSWORD:-$(generate_secret)}"
TSDB_PASSWORD="${TSDB_PASSWORD:-$(generate_secret)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_secret)}"
ADMIN_API_KEY="${ADMIN_API_KEY:-$(generate_secret)}"
MQTT_CHIRPSTACK_PASSWORD="${MQTT_CHIRPSTACK_PASSWORD:-$(generate_secret)}"
MQTT_GATEWAY_BRIDGE_PASSWORD="${MQTT_GATEWAY_BRIDGE_PASSWORD:-$(generate_secret)}"
MQTT_API_PASSWORD="${MQTT_API_PASSWORD:-$(generate_secret)}"
MQTT_INGESTION_PASSWORD="${MQTT_INGESTION_PASSWORD:-$(generate_secret)}"

echo "Writing ${APP_ENV_FILE} (0600)..."
cat > "${APP_ENV_FILE}" <<EOF
# Production Environment Variables - Auto-generated $(date -u +"%Y-%m-%d %H:%M:%SZ")
# Permissions MUST remain 0600

DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

APP_DB_USERNAME=airquality
APP_DB_PASSWORD=${APP_DB_PASSWORD}
APP_DB_NAME=airquality

TSDB_USERNAME=airquality
TSDB_PASSWORD=${TSDB_PASSWORD}
TSDB_NAME=telemetry

REDIS_PASSWORD=${REDIS_PASSWORD}

ADMIN_API_KEY=${ADMIN_API_KEY}

MQTT_CHIRPSTACK_PASSWORD=${MQTT_CHIRPSTACK_PASSWORD}
MQTT_GATEWAY_BRIDGE_PASSWORD=${MQTT_GATEWAY_BRIDGE_PASSWORD}
MQTT_API_PASSWORD=${MQTT_API_PASSWORD}
MQTT_INGESTION_PASSWORD=${MQTT_INGESTION_PASSWORD}
EOF

chmod 0600 "${APP_ENV_FILE}"

echo "Creating Mosquitto password file ${MOSQUITTO_PASSWD_FILE}..."
# Use dockerized mosquitto_passwd to avoid requiring local host packages
touch "${MOSQUITTO_PASSWD_FILE}"
chmod 0600 "${MOSQUITTO_PASSWD_FILE}"

docker run --rm \
  -v "${CONFIG_DIR}:/etc/mosquitto" \
  eclipse-mosquitto:2 \
  sh -c "
    mosquitto_passwd -b -c /etc/mosquitto/mosquitto.passwd chirpstack '${MQTT_CHIRPSTACK_PASSWORD}'
    mosquitto_passwd -b /etc/mosquitto/mosquitto.passwd gateway_bridge '${MQTT_GATEWAY_BRIDGE_PASSWORD}'
    mosquitto_passwd -b /etc/mosquitto/mosquitto.passwd api '${MQTT_API_PASSWORD}'
    mosquitto_passwd -b /etc/mosquitto/mosquitto.passwd ingestion '${MQTT_INGESTION_PASSWORD}'
  "

# Set ownership to mosquitto user (uid 1883)
chown 1883:1883 "${MOSQUITTO_PASSWD_FILE}"

# Copy Mosquitto config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -f "${REPO_ROOT}/deploy/mqtt/mosquitto.prod.conf" ]; then
  cp "${REPO_ROOT}/deploy/mqtt/mosquitto.prod.conf" "${MOSQUITTO_CONF_FILE}"
  chmod 0644 "${MOSQUITTO_CONF_FILE}"
fi

# Ensure ChirpStack configuration directory exists
mkdir -p "${CONFIG_DIR}/chirpstack"
if [ -d "${REPO_ROOT}/edge/chirpstack" ]; then
  cp -r "${REPO_ROOT}/edge/chirpstack/"* "${CONFIG_DIR}/chirpstack/"
  chmod -R 0644 "${CONFIG_DIR}/chirpstack"/*
fi

echo "=== Production secrets initialized successfully in ${CONFIG_DIR} ==="
