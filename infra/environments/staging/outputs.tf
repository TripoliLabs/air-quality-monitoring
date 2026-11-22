output "server_id" {
  description = "Staging server ID"
  value       = module.host.server_id
}

output "server_ip" {
  description = "Staging IPv4 address"
  value       = module.host.server_ip
}

output "server_ipv6" {
  description = "Staging IPv6 address"
  value       = module.host.server_ipv6
}

output "volume_id" {
  description = "Staging block volume ID"
  value       = module.host.volume_id
}

output "firewall_id" {
  description = "Staging firewall ID"
  value       = module.host.firewall_id
}
