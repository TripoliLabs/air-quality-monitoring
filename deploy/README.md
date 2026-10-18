# deploy/ — Runtime Composition & Deployment

Runtime container orchestration, reverse proxy, broker configs, secret provisioning, and backup scripts.

## Directory Structure

```
deploy/
├── compose/
│   ├── docker-compose.prod.yml   # Production compose stack (Hetzner Cloud, immutable GHCR tags)
│   └── Caddyfile                 # Caddy reverse proxy config (automatic TLS + HSTS)
├── mqtt/
│   └── mosquitto.prod.conf       # Production Mosquitto broker config (authenticated, persistent)
├── scripts/
│   ├── setup-production-secrets.sh # Secrets generator & permission enforcer (/etc/aq)
│   └── deploy.sh                 # Zero-downtime deployment script with health gate & rollback
├── backups/
│   ├── backup-logical.sh         # Tier 1: Daily pg_dump logical backups
│   └── backup-physical-wal.sh    # Tier 2: Physical base backups + continuous WAL archiving (PITR)
├── local/                        # Local dev configurations (Postgres init, dev Mosquitto)
├── observability/                # Observability stack (Grafana provisioning, alerts.yaml, Alloy configs)
└── onprem/                       # Gateway-box provisioning
```

- Local full-stack dev uses the root `docker-compose.yml`.
- Production deployment architecture and runbooks: see [`docs/production-deployment.md`](../docs/production-deployment.md).
