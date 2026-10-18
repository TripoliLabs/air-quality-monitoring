terraform {
  required_version = ">= 1.6.0"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }
}

resource "hcloud_server" "host" {
  name        = "aq-${var.environment}-host"
  image       = var.image
  server_type = var.server_type
  location    = var.location
  ssh_keys    = var.ssh_keys

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    environment        = var.environment
    tailscale_auth_key = var.tailscale_auth_key
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  labels = {
    project     = "air-quality"
    environment = var.environment
    managed_by  = "opentofu"
  }
}

resource "hcloud_volume" "data" {
  name     = "aq-${var.environment}-data"
  size     = var.volume_size
  location = var.location
  format   = "ext4"

  labels = {
    project     = "air-quality"
    environment = var.environment
    managed_by  = "opentofu"
  }
}

resource "hcloud_volume_attachment" "data_attachment" {
  volume_id = hcloud_volume.data.id
  server_id = hcloud_server.host.id
  automount = false
}

resource "hcloud_firewall_attachment" "host_firewall" {
  firewall_id = hcloud_firewall.default.id
  server_ids  = [hcloud_server.host.id]
}
