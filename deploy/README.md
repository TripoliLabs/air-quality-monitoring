# Runtime deployment

Production runs on a single Netcup server. Follow the
[production runbook](../docs/production-deployment.md) from bootstrap to recovery.

- `compose/`: immutable application images, Caddy TLS/HSTS, internal backing services.
- `chirpstack/`: production configuration using environment credentials and QoS 1 uplinks.
- `mqtt/`: authenticated Mosquitto and per-user topic permissions.
- `scripts/`: secrets initialization and application-only deployment with health-gated rollback.
- `backups/`: nightly logical dumps of both databases and mandatory off-site uploads.
- `observability/`: Alloy forwarding, dashboards and alert rules.
- `local/`: local development backing-service configuration.
- `onprem/`: gateway-box documentation.

Plaintext credentials live only in `/opt/aq/.env` on the host. Successful deployments
update the `/opt/aq/deploy` symlink; retained releases and `/mnt/data` survive updates.
Ingestion briefly restarts; persistent MQTT sessions queue QoS 1 uplinks during the gap.
