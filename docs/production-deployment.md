# Production Deployment: Architecture, Secrets, Backups & Runbooks

Canonical reference and operational guide for the production deployment of the Tripoli Air Quality Monitoring Network on Hetzner Cloud (addressing Issue #51).

---

## 1. Architectural Boundary & Overview

### 1.1 Single-Node Architecture Boundary (Important)

> [!IMPORTANT]
> The initial production deployment is a single-node deployment optimized for operational simplicity, cost efficiency, and ease of management. Disaster recovery (DR) is provided through automated off-site backups (logical + continuous WAL archiving) and Infrastructure-as-Code (OpenTofu). High availability (HA), multi-node clustering, and automated failover are intentionally outside the scope of Issue #51. If the underlying Hetzner VM experiences hardware failure, availability will be temporarily interrupted while the instance or volume is recovered.

### 1.2 System Topology

```
┌───────────────────────────────── GitHub Actions CI/CD ──────────────────────────────────┐
│  Commit (abc1234) ──► Build Once & Push Immutable Images to GHCR ──► Deploy Staging     │
│                                                                           │ (Tailscale) │
│                                            Manual Approval Gate           ▼             │
│                                            Deploy SAME Image SHA ──► Deploy Production  │
└───────────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │ Private Tailnet
                                                ▼
┌────────────────────────────── Hetzner Cloud CX42 VM ───────────────────────────────────┐
│                                                                                         │
│  Public Ingress:                                                                        │
│   • Ports 80 & 443/tcp ────────► [Caddy Edge Reverse Proxy (Automatic TLS + HSTS)]      │
│                                    │                      │                             │
│                                    ▼                      ▼                             │
│                           [Dashboard SPA (:80)]   [REST/WS API (:3000)]                 │
│                                                           │                             │
│   • Port 1700/udp ────────► [ChirpStack Gateway Bridge]  │                             │
│                                    │                      │                             │
│                                    ▼                      ▼                             │
│   Internal Network:        [ChirpStack v4] ◄────► [Mosquitto MQTT (Auth)]               │
│   (Zero external ports)            │                      │                             │
│                                    ▼                      ▼                             │
│                            [PostgreSQL 18]        [Ingestion Service (:3001)]           │
│                            (Relational & Auth)            │                             │
│                                    ▲                      ▼                             │
│                                    │             [TimescaleDB (TSL)]                    │
│                                    │             (Hypertable Telemetry)                 │
│                                    └────── [Redis 8 (Cache & PubSub)]                   │
│                                                                                         │
│  Observability:                                                                         │
│   • [Grafana Alloy Collector] ──────────────────────────► Grafana Cloud (OTLP/Logs)     │
│                                                                                         │
│  Storage & Disaster Recovery:                                                           │
│   • Attached Block Storage (/mnt/data - 100GB ext4)                                     │
│   • Tier 1: Daily logical pg_dump snapshots ────────────┐                               │
│   • Tier 2: Physical base backups + Continuous WAL ─────┼─► Off-site S3 Storage         │
│   • Automated PITR restore drill (scripts/db-restore-drill.sh)                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure as Code (OpenTofu)

Infrastructure provisioning is located under `infra/` and managed with OpenTofu (`tofu`).

- **Compute:** Hetzner Cloud `cx42` (8 vCPU, 16GB RAM) in Falkenstein (`fsn1`).
- **Persistent Storage:** Hetzner Block Storage (100GB in production, 50GB in staging) attached and mounted to `/mnt/data`.
- **Hetzner Cloud Firewall:** Uses Hetzner's native **implicit inbound deny**. Only explicitly allowed ports accept inbound packets:
  - `80/tcp` — HTTP (Let's Encrypt ACME challenges and automatic HTTPS redirects)
  - `443/tcp` — HTTPS (Dashboard web application and API)
  - `1700/udp` — Semtech UDP packet forwarder from LoRaWAN outdoor gateways
  - `22/tcp` — Direct SSH restricted exclusively to administrative CIDRs (`allowed_ssh_ips`)
- **State Backend & Locking:** Native OpenTofu S3 state backend with `use_lockfile = true`, server-side encryption, and bucket versioning. Separate state keys are maintained for staging (`staging/terraform.tfstate`) and production (`production/terraform.tfstate`).

---

## 3. Network Security & Ingress

### 3.1 Zero-Trust Internal Networking

All persistent datastores, brokers, caches, and application services run within the isolated Docker bridge network `aq_net`. None of these ports are published to the host:
- PostgreSQL (`5432`) — internal only
- TimescaleDB (`5432`) — internal only
- Redis (`6379`) — internal only
- Mosquitto MQTT (`1883`) — internal only
- NestJS API (`3000`) and Ingestion (`3001`) — internal only
- Web Dashboard (`80`) — internal only

### 3.2 Private Deployment Channel via Tailscale

GitHub Actions runners do not have static IP addresses. Rather than opening SSH port 22 to `0.0.0.0/0`, the deployment pipeline connects to target VMs over a private **Tailscale** overlay network. The runner authenticates via `tailscale/github-action` using a reusable auth key (`TAILSCALE_AUTHKEY`), accessing the host securely at `aq-staging-host` or `aq-production-host`.

### 3.3 Security Notice: Semtech UDP Forwarder (Port 1700/UDP)

The legacy Semtech UDP packet forwarder protocol used by gateway port 1700/udp lacks native authentication. ChirpStack documentation highlights this as a known limitation of the Semtech UDP specification.
- **Current Compatibility:** Port 1700/udp is kept open for compatibility with existing Dragino DLOS8N outdoor gateways deployed across Tripoli.
- **Migration Roadmap:** Future gateway firmware revisions will transition to **LoRa Basics Station** communicating over WebSockets with mutual TLS (WSS + mTLS), terminating securely at the ChirpStack Gateway Bridge with cryptographic client certificates.

### 3.4 Caddy Edge Reverse Proxy

Caddy (`caddy:2.9-alpine`) handles public ingress and TLS termination:
- **Persistent Storage:** Caddy certificate stores `/data` and `/config` are mounted to `/mnt/data/caddy/data` and `/mnt/data/caddy/config` to prevent rate-limiting during restarts.
- **Strict Transport Security (HSTS):** Configured explicitly:
  ```caddy
  header {
      Strict-Transport-Security "max-age=31536000; includeSubDomains"
      X-Content-Type-Options "nosniff"
      X-Frame-Options "DENY"
      Referrer-Policy "strict-origin-when-cross-origin"
  }
  ```
- **Routing:**
  - `{$DOMAIN}`: Serves the Web SPA, routing `/api/*` and `/socket.io/*` directly to `api:3000`.
  - `api.{$DOMAIN}`: Reverse proxies directly to `api:3000`.

---

## 4. Production Secrets & Configuration

Production secrets are kept in `/etc/aq` with restricted permissions (`0700` directory, `0600` files). They are never committed to version control.

### 4.1 Secrets Initialization

Run the automated provisioning script on the host:
```bash
sudo /opt/aq/deploy/scripts/setup-production-secrets.sh aq.tripolilabs.org admin@tripolilabs.org
```

This generates:
1. `/etc/aq/app.env` (0600) — High-entropy passwords for PostgreSQL, TimescaleDB, Redis, API key, and MQTT users.
2. `/etc/aq/mosquitto.passwd` (0600, owner `1883:1883`) — Hashed password credentials for `chirpstack`, `gateway_bridge`, `api`, and `ingestion`.
3. `/etc/aq/mosquitto.conf` (0644) — Production broker configuration with `allow_anonymous false` and persistence enabled.

---

## 5. Dual-Tier Backup System & Point-in-Time Recovery (PITR)

Disaster recovery employs two distinct backup tiers:

### 5.1 Tier 1: Daily Logical Backups (`pg_dump`)

- **Script:** `/opt/aq/deploy/backups/backup-logical.sh`
- **Schedule:** Nightly cron at 02:00 UTC.
- **Format:** Custom PostgreSQL compressed archives (`-Fc -Z 6`) for PostgreSQL (`airquality`) and TimescaleDB (`telemetry`).
- **Retention:** 7 days locally at `/mnt/data/backups/logical/`, uploaded to `s3://${BACKUP_S3_BUCKET}/logical/`.
- **Purpose:** Fast table-level inspection, migration across major engine versions, and accidental schema recovery.

### 5.2 Tier 2: Physical Base Backups + Continuous WAL Archiving (PITR)

- **Script:** `/opt/aq/deploy/backups/backup-physical-wal.sh`
- **Schedule:** Weekly base backup + continuous WAL segment streaming.
- **Mechanism:** `pg_basebackup` tar format gzipped + continuous WAL archive logs saved to `/mnt/data/backups/physical/wal/` and synced to `s3://${BACKUP_S3_BUCKET}/wal/`.
- **Retention:** 14 days of base backups, WAL kept to match base backup retention.
- **Purpose:** True Point-in-Time Recovery. Allows restoring the database to any millisecond before an incident or corruption event.

### 5.3 Automated PITR Restore Drill

The repository includes an automated, non-destructive restore drill in [`scripts/db-restore-drill.sh`](file:///c:/Users/USER/Desktop/My_Projects/air-quality-monitoring/scripts/db-restore-drill.sh). It validates:
1. Physical base backup restoration.
2. WAL replay to a precise timestamp $T_{target}$.
3. Proof that data committed prior to $T_{target}$ is restored and subsequent corruptions are discarded.

Run the drill locally or on staging:
```bash
bash scripts/db-restore-drill.sh
```

---

## 6. CI/CD Deployment Pipeline (`.github/workflows/deploy.yml`)

The continuous delivery pipeline enforces the **Build Once, Deploy Immutable Image** pattern:

1. **Build Once:**
   - On push to `main` (or manual `workflow_dispatch`), GitHub Actions builds multi-stage production targets for `api`, `ingestion`, `dashboard`, and `migrate`.
   - Images are pushed to GitHub Container Registry (GHCR) tagged with the short commit SHA (`${IMAGE_SHA}`).
2. **Deploy to Staging:**
   - Connects to `aq-staging-host` over Tailscale.
   - Executes `/opt/aq/deploy/scripts/deploy.sh ${IMAGE_SHA}`.
   - Evaluates the **Deployment Health Gate**.
3. **Manual Production Approval Gate:**
   - Pull request reviewers or repository administrators approve promotion to `production`.
   - The deployment job pulls and runs the **exact same immutable image SHA** previously verified in staging. No building or recompiling occurs on the production VM.
4. **Automated Health Gate & Rollback:**
   - Post-deployment verification tests:
     - PostgreSQL (`pg_isready`)
     - TimescaleDB (`pg_isready`)
     - Redis (`redis-cli ping`)
     - Mosquitto MQTT broker (`mosquitto_sub`)
     - REST & WebSocket API (`GET /health`)
     - Ingestion pipeline (`GET /health`)
     - Web Dashboard (`GET /healthz`)
   - If any check fails after 30 attempts, the deployment script triggers an automated rollback to `${PREVIOUS_IMAGE_SHA}`, records logs, and alerts operators.

---

## 7. Monitoring & Alerting

Grafana Alloy collects OpenTelemetry metrics and traces, shipping them to Grafana Cloud. Production alerts are provisioned in `deploy/observability/provisioning/alerting/alerts.yaml`:

| Alert UID | Description | Threshold | Severity |
|---|---|---|---|
| `aq-no-readings` | Ingestion stalled | No readings for 5 minutes | `critical` |
| `aq-api-5xx` | High HTTP 5xx error rate | > 0 errors over 5 minutes | `warning` |
| `aq-gateway-offline` | LoRaWAN gateway disconnected | No bridge events for 15 minutes | `critical` |
| `aq-node-low-battery` | Sensor node battery critical | Voltage < 3.4V (~20% battery) | `warning` |
| `aq-disk-space-low` | Persistent storage full | Disk usage on `/mnt/data` > 80% | `warning` |

---

## 8. Operational Runbooks

### 8.1 Initial Host Provisioning

```bash
# 1. Format check and validate OpenTofu code
tofu fmt -check -recursive infra
cd infra/environments/production
tofu init
tofu plan -out=tfplan
tofu apply tfplan

# 2. SSH into host via Tailscale or restricted management IP
ssh root@aq-production-host

# 3. Clone repository and initialize production secrets
git clone https://github.com/TripoliLabs/air-quality-monitoring.git /opt/aq
cd /opt/aq
sudo /opt/aq/deploy/scripts/setup-production-secrets.sh aq.tripolilabs.org admin@tripolilabs.org

# 4. Trigger initial deployment with current SHA
/opt/aq/deploy/scripts/deploy.sh $(git rev-parse --short HEAD) /opt/aq/deploy/compose
```

### 8.2 Manual Deployment & Emergency Rollback

```bash
# Deploy a specific verified image tag
sudo /opt/aq/deploy/scripts/deploy.sh a1b2c3d /opt/aq/deploy/compose

# Emergency manual rollback to a known good image tag
export IMAGE_SHA="previous-stable-sha"
docker compose -f /opt/aq/deploy/compose/docker-compose.prod.yml up -d --remove-orphans
```

### 8.3 Disaster Recovery: Restoring from Tier 1 Logical Backup

```bash
# Stop application services
docker compose -f /opt/aq/deploy/compose/docker-compose.prod.yml stop api ingestion dashboard

# Restore PostgreSQL relational schema and data
docker exec -i aq-postgres dropdb -U airquality --if-exists airquality
docker exec -i aq-postgres createdb -U airquality airquality
docker exec -i aq-postgres pg_restore -U airquality -d airquality < /mnt/data/backups/logical/relational_YYYYMMDD_HHMMSSZ.dump

# Restore TimescaleDB telemetry data
docker exec -i aq-timescaledb dropdb -U airquality --if-exists telemetry
docker exec -i aq-timescaledb createdb -U airquality telemetry
docker exec -i aq-timescaledb pg_restore -U airquality -d telemetry < /mnt/data/backups/logical/telemetry_YYYYMMDD_HHMMSSZ.dump

# Restart services
docker compose -f /opt/aq/deploy/compose/docker-compose.prod.yml start api ingestion dashboard
```
