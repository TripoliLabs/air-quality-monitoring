# Infrastructure (OpenTofu — Hetzner Cloud)

Provisioning for cloud infrastructure environments using [OpenTofu](https://opentofu.org/).
Provisioning (`infra/`) manages cloud resources (VMs, persistent block storage, firewall),
while deployment (`deploy/`) orchestrates runtime container services (Docker Compose, Caddy).

## Directory Structure

```
infra/
├── modules/
│   └── hetzner_host/             # Reusable module: VM (CX42), persistent volume, firewall
└── environments/
    ├── staging/                  # Staging environment root module
    └── production/               # Production environment root module
```

## Architecture

- **Compute:** Hetzner Cloud VM (`cx42`: 8 vCPU, 16GB RAM for production; `cx32` for staging).
- **Storage:** Dedicated Hetzner Block Storage volume (100GB in prod, 50GB in staging) mounted at `/mnt/data` for persistent databases (PostgreSQL, TimescaleDB), caches, broker data, and local backups.
- **Firewall:** Hetzner Cloud Firewall with **implicit inbound deny**. Only required ports are explicitly allowed:
  - `80/tcp` — HTTP (ACME challenges and redirects)
  - `443/tcp` — HTTPS (Dashboard and API)
  - `1700/udp` — Semtech UDP packet forwarder from LoRaWAN gateways
  - `22/tcp` — Management SSH restricted strictly to `allowed_ssh_ips`
- **State Backend:** OpenTofu native S3 backend with state locking (`use_lockfile = true`), server-side encryption, and bucket versioning. Separate state keys are used for staging and production:
  - Staging: `staging/terraform.tfstate`
  - Production: `production/terraform.tfstate`

## State Locking & OpenTofu Workflow

OpenTofu 1.6+ natively supports S3 state locking through conditional writes (`use_lockfile = true`) without requiring an external DynamoDB table. When using S3-compatible object storage (e.g., Hetzner Object Storage or AWS S3), ensure the target provider supports conditional writes.

Always use `tofu` CLI commands:

```bash
# 1. Format check
tofu fmt -check -recursive

# 2. Initialize environment with backend configuration
cd infra/environments/staging # or production
tofu init \
  -backend-config="bucket=aq-opentofu-state" \
  -backend-config="endpoint=https://fsn1.your-objectstorage.com" \
  -backend-config="region=eu-central"

# 3. Validate configuration
tofu validate

# 4. Plan execution
tofu plan -var-file=terraform.tfvars

# 5. Apply changes
tofu apply -var-file=terraform.tfvars
```
