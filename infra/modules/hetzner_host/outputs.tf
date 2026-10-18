output "server_id" {
  description = "Hetzner server ID"
  value       = hcloud_server.host.id
}

output "server_ip" {
  description = "Public IPv4 address of the host"
  value       = hcloud_server.host.ipv4_address
}

output "server_ipv6" {
  description = "Public IPv6 address of the host"
  value       = hcloud_server.host.ipv6_address
}

output "volume_id" {
  description = "Attached persistent block volume ID"
  value       = hcloud_volume.data.id
}

output "firewall_id" {
  description = "Attached firewall ID"
  value       = hcloud_firewall.default.id
}
