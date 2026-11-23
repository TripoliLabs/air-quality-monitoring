# Production deployment — Netcup

This runbook targets a **fresh Ubuntu 24.04 x86-64 Netcup root server**. There is
one production host. Local Docker Compose is the pre-production test environment.
The host is ordered manually; bootstrap installs the operating-system prerequisites.
Application CD never updates backing services. No live infrastructure is created by a PR.

Repository validation: `bash scripts/test-deployment.sh` exercises deployment and
backup failures without Docker (also runs in CI). `python scripts/test-production.py`
uses disposable Docker services to test authenticated startup, logical restores and
offline MQTT delivery. It requires Bash; on Windows set `BASH_PATH` to Git Bash.
Neither replaces checking bootstrap/SSH/firewall behavior on a disposable Ubuntu VM
before applying it to the actual Netcup host.

## 1. Order and bootstrap the host

1. Order the server through Netcup and install Ubuntu 24.04. Keep console access.
2. Generate separate SSH keys for the administrator and GitHub deployment. Keep
   private keys off the server; copy only their public keys during bootstrap.
3. Copy `infra/` and the two public keys to the server using its initial root access.
   On the server, run:

   ```bash
   bash infra/bootstrap.sh admin.pub deploy.pub
   ```

   This installs Docker/Compose, automatic security updates, S3 upload tooling,
   and a nightly backup schedule. It creates `admin` (passwordless sudo) and
   `deploy` (Docker access, no sudo), `/opt/aq`, and persistent `/mnt/data` directories.
   It does not format disks or replace database contents. Re-running preserves data.
   Docker group membership is effectively root access: protect the deployment key.
4. From a **new terminal**, confirm `ssh admin@HOST` and `sudo -n true` work.
   Keep the original session open, then run `sudo bash infra/bootstrap.sh --lock-ssh`.
   This disables password authentication and root SSH login. Use the Netcup console
   if SSH access ever needs recovery.
5. Check `sudo ufw status` and `sudo systemctl status aq-docker-firewall`.
   Public ingress is limited to 22/tcp, 80/tcp, 443/tcp and 1700/udp. A separate
   DOCKER-USER filter covers published ports which bypass UFW's INPUT chain.
6. Point the dashboard domain and its `api.` subdomain at this host. Use an IPv4
   address or DNS name for `DEPLOY_HOST`. Add AAAA records only if IPv6 is configured.

## 2. Install release assets and secrets

Copy the repository's `deploy/` directory to `/opt/aq/releases/bootstrap/deploy/`
as `deploy` (create the parent directory first). On the host:

```bash
sudo -iu deploy
ln -s /opt/aq/releases/bootstrap/deploy /opt/aq/deploy
bash /opt/aq/deploy/scripts/setup-production-secrets.sh aq.tripolilabs.org admin@tripolilabs.org
```

The only plaintext application secret source is `/opt/aq/.env`, owned by `deploy`,
mode `600`. The setup script appends missing values and preserves existing entries.
The file is trusted shell input as well as Compose input: use `KEY='literal-value'`,
with no embedded single quotes, multiline values, or shell commands. Generated
passwords use URL-safe hex. Do not commit this file or put application secrets in GitHub.

Edit `.env` on the server to supply:

- `BACKUP_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
  `AWS_DEFAULT_REGION`. For non-AWS storage also set `BACKUP_S3_ENDPOINT=https://...`.
  Grant the key upload access to this bucket's `logical/` prefix. Configure bucket
  lifecycle separately; keep at least 30 days off-site as the initial policy.
- The seven `GRAFANA_CLOUD_*` entries, using your Grafana Cloud endpoints, instance
  IDs and write token. See [observability](../deploy/observability/README.md).

Setup generates a Mosquitto salted password file under `/opt/aq/generated/mqtt/`.
ChirpStack reads credentials from container environment variables; production TOML
contains variable references, not passwords. PostgreSQL, Redis, MQTT and ChirpStack
are internal to Docker. Ingestion subscribes at QoS 1 with a stable persistent session;
ChirpStack publishes uplinks at QoS 1 so a brief ingestion restart can queue messages.
The finite broker queue is not protection against arbitrarily long outages.

Back up `.env` securely outside this server using your team's password manager.
Database dumps do not contain these external service credentials. Credential rotation
requires updating the corresponding database/broker account as well as `.env`;
rerunning setup does not rotate live database passwords automatically.

## 3. Publish images and start production for the first time

After this PR merges, CI runs its existing quality and integration jobs. Successful
CI for a `main` push triggers CD, which builds API, ingestion, dashboard and migration
images, scans for fixable critical vulnerabilities, and publishes full commit SHA tags.
A failed scan blocks deployment. No application deployment occurs until enabled.

Choose the full 40-character SHA of a successful image publication. As `deploy`:

```bash
export IMAGE_SHA=FULL_40_CHARACTER_PUBLISHED_COMMIT_SHA
# Default is ghcr.io/tripolilabs/air-quality; override if publishing under another owner.
export IMAGE_PREFIX=ghcr.io/tripolilabs/air-quality
compose=(docker compose --env-file /opt/aq/.env -f /opt/aq/deploy/compose/docker-compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait postgres timescaledb redis mqtt chirpstack chirpstack-gateway-bridge
bash /opt/aq/deploy/scripts/deploy.sh "$IMAGE_SHA"
"${compose[@]}" up -d --no-deps caddy alloy
```

Public GHCR images need no login. For private packages, set `GHCR_USER` and pipe a
short-lived package-read token into `deploy.sh`; it uses a temporary Docker config
and removes it on exit. Ensure the repository's Actions token has package access.

Both PostgreSQL 18 images mount `/var/lib/postgresql`. Retain `/mnt/data` across
container recreation. Never use `down -v` as an update.
Provision real gateways/devices through ChirpStack before expecting sensor data;
production does not run the simulator. ChirpStack's web UI is not published; for
administration use an SSH tunnel to its container address obtained on the server.

Confirm the public dashboard, `/api/health`, live readings and Grafana telemetry.
Caddy issues certificates and sets HSTS; certificates persist under `/mnt/data/caddy`.

## 4. Enable automatic deployments

In GitHub, create the `production` environment and configure protection rules as desired.
Set these three secrets for that environment:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Host DNS name or IPv4 address |
| `DEPLOY_SSH_KEY` | Private key corresponding to `deploy`'s authorized public key |
| `DEPLOY_KNOWN_HOSTS` | Host key entry from `ssh-keyscan -H HOST` |

Verify the scanned host-key fingerprint against the server console before trusting
it. The workflow enforces strict host-key checking; it never accepts a replacement
key automatically. Set **repository variable** `DEPLOY_ENABLED=true` only after
initial setup and validation. Leave it unset or false to build images without deploying.

Automatic deploys use the exact CI-tested SHA and skip superseded commits. GitHub
serializes deployments; the host also uses `flock`. Release assets are retained under
`/opt/aq/releases/`; `.env`, generated credentials and persistent data are never overwritten.
The server pulls just four release images, runs migrations, then updates only
`api ingestion dashboard` using `--no-deps`. Backing services, Caddy and Alloy remain
running. Update those explicitly during a separately planned maintenance window.

All three application Docker health checks must pass before success is recorded in
`/opt/aq/current_image_sha`. `/opt/aq/current_compose_dir` and the `/opt/aq/deploy`
symlink identify the successful release. Retain older release directories: running
backing services may still bind-mount their configuration files from those paths.

## 5. Rollback and failures

- Image pull or migration failure: fail before updating applications. Inspect the
  logs and migration state; an unsuccessful migration may have partially applied SQL.
- Application startup or health failure: restore the previous successful application's
  images and Compose configuration, verify health again, and fail the job even if
  rollback succeeds. If rollback fails, the script reports operator intervention.
- First deployment failure: there is no previous release. Leave containers available
  for inspection; fix the fault and retry. Never mark the failed SHA successful.
- Manual rollback: run **CD - Build & Deploy** with `workflow_dispatch` from `main`
  and the full SHA of an already published release. It does not rebuild images.
  The SHA must belong to `main` history and use this deployment layout.

Rollbacks do **not** reverse database migrations. Changes must preserve compatibility
with the previous application release. Use expand/contract migrations; if a migration
breaks that compatibility, plan a maintenance restore instead of assuming image rollback
can fix it. Infrastructure/credential changes also require operator planning.

## 6. Backups and recovery

Bootstrap schedules backups at **02:00 UTC nightly** as `deploy`. Both databases get
custom-format logical dumps, image-version metadata and SHA-256 checksums, uploaded
to `logical/` in S3-compatible storage. A timestamped `.complete` marker is uploaded
only after both sets succeed. Seven days are retained locally. Missing credentials,
missing upload tools and upload errors fail the backup instead of silently skipping it.

```bash
bash /opt/aq/deploy/backups/backup-logical.sh
cat /mnt/data/backups/logical/last-run.status
journalctl -t aq-backup --since yesterday
```

Monitor the last-run status and missing/stale completed backups. Existing application
alert rules remain in `deploy/observability/provisioning/alerting/alerts.yaml`; configure
Grafana contact points. Grafana Cloud does not automatically import local provisioning.
Daily dumps imply up to approximately one day's loss following a host failure (longer
if backups are failing). There is no PITR or automatic failover in Phase 1.

Monthly, download a completed pair plus its `.image` and `.sha256` files to a machine
with Docker and run the repository's restore drill:

```bash
bash scripts/db-restore-drill.sh relational_TIMESTAMP.dump telemetry_TIMESTAMP.dump
```

It starts isolated containers with no network or production volumes, verifies checksums,
restores both databases and checks sensors, readings, the hypertable and hourly aggregate.
Timescale restore calls `timescaledb_pre_restore()` before serial `pg_restore`, then
`timescaledb_post_restore()` afterward. Do not use parallel `pg_restore -j`.

For disaster recovery: bootstrap a replacement server; restore `.env` from secure
storage; install retained release assets; start empty backing databases with the recorded
image versions; restore each dump with `pg_restore --exit-on-error --no-owner --no-privileges`
using its configured database user. For Timescale, create the extension and call the
pre/post-restore functions as in the drill. Run the drill's validation queries, deploy
the compatible application SHA, start Caddy/Alloy and verify public health and real
uplinks before changing DNS. Restore to empty databases, never over a live workload.
