#!/usr/bin/env bash
# Run as root on a fresh Ubuntu 24.04 server. Re-running preserves data and keys.
# bootstrap.sh <admin-public-key-file> <deploy-public-key-file>
# bootstrap.sh --lock-ssh (only after testing an independent admin SSH session)
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
# shellcheck source=/dev/null
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'Ubuntu 24.04 required.' >&2; exit 1; }
if [[ "${1:-}" == --lock-ssh ]]; then
  test -s /home/admin/.ssh/authorized_keys
  id admin >/dev/null
  install -d -m 755 /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/00-aq.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
  sshd -t
  systemctl reload ssh
  echo 'SSH locked: use admin key access; retain the Netcup console for recovery.'
  exit 0
fi
ADMIN_KEY="${1:?Provide admin public key file}"
DEPLOY_KEY="${2:?Provide deploy public key file}"
ssh-keygen -lf "$ADMIN_KEY" >/dev/null
ssh-keygen -lf "$DEPLOY_KEY" >/dev/null
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y docker.io docker-compose-v2 ufw unattended-upgrades \
  ca-certificates curl openssl python3 sudo awscli cron
systemctl enable --now docker cron
for account in admin deploy; do
  id "$account" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$account"
  install -d -m 700 -o "$account" -g "$account" "/home/$account/.ssh"
done
usermod -aG sudo admin
usermod -aG docker deploy
printf 'admin ALL=(ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/aq-admin
chmod 440 /etc/sudoers.d/aq-admin
visudo -cf /etc/sudoers.d/aq-admin
install -m 600 -o admin -g admin "$ADMIN_KEY" /home/admin/.ssh/authorized_keys
install -m 600 -o deploy -g deploy "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1700/udp
ufw --force enable
# Docker-published ports bypass UFW INPUT. Filter new external forwarded traffic too.
install -m 755 "$(dirname "$0")/docker-firewall.sh" /usr/local/sbin/aq-docker-firewall
cat > /etc/systemd/system/aq-docker-firewall.service <<'EOF'
[Unit]
Description=Air quality Docker ingress firewall
After=docker.service ufw.service
Requires=docker.service
PartOf=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/aq-docker-firewall
RemainAfterExit=yes
[Install]
WantedBy=docker.service
EOF
systemctl daemon-reload
systemctl enable aq-docker-firewall
systemctl restart aq-docker-firewall
install -d -m 750 -o deploy -g deploy /opt/aq /opt/aq/releases
install -d -m 755 /mnt/data
for directory in postgres timescale redis mosquitto caddy/data caddy/config alloy; do
  mkdir -p "/mnt/data/$directory"
done
# Official images initialize database ownership themselves; never chown existing DBs.
chmod 700 /mnt/data/postgres /mnt/data/timescale
chown 999:999 /mnt/data/redis
chown 1883:1883 /mnt/data/mosquitto
install -d -m 700 -o deploy -g deploy /mnt/data/backups /mnt/data/backups/logical
cat > /etc/cron.d/aq-backup <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Server timezone is UTC (set below). Failures go to syslog and the status file.
0 2 * * * deploy /bin/bash /opt/aq/deploy/backups/backup-logical.sh 2>&1 | /usr/bin/logger -t aq-backup
EOF
chmod 644 /etc/cron.d/aq-backup
timedatectl set-timezone UTC
echo 'Bootstrap complete. Test admin SSH + sudo in a NEW session, then run --lock-ssh.'
echo 'Docker membership grants deploy effective root access; protect its SSH key.'
