#!/usr/bin/env bash
# Run as deploy: setup-production-secrets.sh [domain] [acme-email]
# The .env file is trusted shell input: KEY='value', no command substitutions.
set -euo pipefail
umask 077
AQ_ROOT="${AQ_ROOT:-/opt/aq}"
[[ $(id -un) == deploy ]] || { echo 'Run as deploy (sudo -iu deploy).' >&2; exit 1; }
ENV_FILE="$AQ_ROOT/.env"
mkdir -p "$AQ_ROOT"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
# Append missing values only: reruns never rotate credentials or discard custom settings.
add_default() {
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    [[ "$value" != *"'"* && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || exit 1
    printf "%s='%s'\n" "$key" "$value" >> "$ENV_FILE"
  fi
}
add_default DOMAIN "${1:-aq.tripolilabs.org}"
add_default ACME_EMAIL "${2:-admin@tripolilabs.org}"
add_default APP_DB_USERNAME airquality
add_default APP_DB_NAME airquality
add_default TSDB_USERNAME airquality
add_default TSDB_NAME telemetry
for key in APP_DB_PASSWORD TSDB_PASSWORD REDIS_PASSWORD ADMIN_API_KEY \
  MQTT_CHIRPSTACK_PASSWORD MQTT_GATEWAY_BRIDGE_PASSWORD MQTT_INGESTION_PASSWORD CHIRPSTACK_API_SECRET; do
  add_default "$key" "$(openssl rand -hex 24)"
done
for key in BACKUP_S3_BUCKET BACKUP_S3_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY \
  GRAFANA_CLOUD_API_TOKEN GRAFANA_CLOUD_TEMPO_ENDPOINT GRAFANA_CLOUD_TEMPO_USER \
  GRAFANA_CLOUD_PROM_URL GRAFANA_CLOUD_PROM_USER GRAFANA_CLOUD_LOKI_URL GRAFANA_CLOUD_LOKI_USER; do
  add_default "$key" ''
done
add_default AWS_DEFAULT_REGION us-east-1
# shellcheck source=/dev/null
source "$ENV_FILE"
# These credentials are interpolated into URI/TOML fields. Generated hex is safe.
for key in APP_DB_USERNAME APP_DB_NAME TSDB_USERNAME TSDB_NAME APP_DB_PASSWORD TSDB_PASSWORD \
  REDIS_PASSWORD MQTT_CHIRPSTACK_PASSWORD MQTT_GATEWAY_BRIDGE_PASSWORD MQTT_INGESTION_PASSWORD CHIRPSTACK_API_SECRET; do
  [[ "${!key}" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "Unsafe or empty value for $key." >&2; exit 1; }
done
mkdir -p "$AQ_ROOT/generated/mqtt"
chmod 755 "$AQ_ROOT/generated" "$AQ_ROOT/generated/mqtt"
# The broker's UID 1883 owns the hashed password file; plaintext stays in .env.
password_tmp=$(mktemp "$AQ_ROOT/generated/mqtt/.passwd.XXXXXX")
trap 'rm -f -- "$password_tmp"' EXIT
for account in chirpstack gateway_bridge ingestion; do
  case "$account" in
    chirpstack) password="$MQTT_CHIRPSTACK_PASSWORD" ;;
    gateway_bridge) password="$MQTT_GATEWAY_BRIDGE_PASSWORD" ;;
    ingestion) password="$MQTT_INGESTION_PASSWORD" ;;
  esac
  printf '%s:%s\n' "$account" "$password" >> "$password_tmp"
done
# Hash in place without putting passwords in process arguments.
docker run --rm -v "$password_tmp:/tmp/passwd" eclipse-mosquitto:2 \
  sh -c 'mosquitto_passwd -U /tmp/passwd && chmod 600 /tmp/passwd && chown 1883:1883 /tmp/passwd'
mv -f "$password_tmp" "$AQ_ROOT/generated/mqtt/mosquitto.passwd"
echo "Secrets preserved/generated in $ENV_FILE. Configure S3 and Grafana values before startup."
echo "Broker password changes require an explicit broker reload/restart; application CD does not do that."
