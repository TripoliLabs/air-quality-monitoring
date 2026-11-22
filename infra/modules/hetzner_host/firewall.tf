resource "hcloud_firewall" "default" {
  name = "aq-${var.environment}-firewall"

  # Explicit ALLOW inbound rules (all other inbound traffic is implicitly denied by Hetzner Cloud Firewall)
  # 1. HTTP traffic (for ACME challenge and HTTP->HTTPS redirect)
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow inbound HTTP for Caddy ACME challenges and HTTPS redirects"
  }

  # 2. HTTPS traffic (public web and API traffic)
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow inbound HTTPS for Caddy reverse proxy to dashboard and API"
  }

  # 3. Semtech UDP packet forwarder from LoRaWAN gateways (port 1700/udp)
  # Note: Semtech UDP protocol lacks gateway authentication. Gateways supporting
  # LoRa Basics Station should migrate to WSS + mTLS (see docs/production-deployment.md).
  rule {
    direction = "in"
    protocol  = "udp"
    port      = "1700"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow inbound Semtech UDP forwarder traffic from LoRaWAN gateways"
  }

  # 4. SSH management access restricted to allowed administrative IPs
  dynamic "rule" {
    for_each = length(var.allowed_ssh_ips) > 0 ? [1] : []
    content {
      direction   = "in"
      protocol    = "tcp"
      port        = "22"
      source_ips  = var.allowed_ssh_ips
      description = "Allow inbound SSH exclusively from authorized management CIDRs"
    }
  }

  # Outbound rules: Allow all egress traffic for package updates, container pulls,
  # OTel export to Grafana Cloud, and off-site backup storage.
  rule {
    direction = "out"
    protocol  = "tcp"
    port      = "any"
    destination_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow all outbound TCP"
  }

  rule {
    direction = "out"
    protocol  = "udp"
    port      = "any"
    destination_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow all outbound UDP (DNS, NTP, WireGuard/Tailscale)"
  }

  rule {
    direction = "out"
    protocol  = "icmp"
    destination_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Allow outbound ICMP"
  }

  labels = {
    project     = "air-quality"
    environment = var.environment
    managed_by  = "opentofu"
  }
}
