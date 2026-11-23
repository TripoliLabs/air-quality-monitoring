# Infrastructure — Netcup

Order one Ubuntu 24.04 x86-64 Netcup root server manually. There is no separate
staging host; use local Docker Compose to validate changes before production.

1. Copy this directory and the administrator/deployment SSH public keys to the host.
2. As root, run `bash infra/bootstrap.sh admin.pub deploy.pub`.
3. Confirm a new `admin` SSH session can run `sudo -n true`.
4. Run `sudo bash infra/bootstrap.sh --lock-ssh` to disable root/password SSH login.
5. Follow the [production runbook](../docs/production-deployment.md) for secrets,
   backing services, application deployment, backups and recovery.

Bootstrap is repeatable, preserves data, and never formats disks. It installs Docker,
security updates, firewall rules (including Docker forwarded ingress), the two users,
nightly backup scheduling and persistent storage directories on the server disk.
The `deploy` account has no sudo, but Docker membership is effectively root access.
Use the Netcup console as the SSH recovery path. Infrastructure maintenance remains
an explicit administrator action; application CI/CD does not restart data services.
