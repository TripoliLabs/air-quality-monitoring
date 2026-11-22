output "server_id" {
  description = "Production server ID"
  value       = module.host.server_id
}

output "server_ip" {
  description = "Production IPv4 address"
  value       = module.host.server_ip
}

output "server_ipv6" {
  description = "Production IPv6 address"
  value       = module.host.server_ipv6
}

output "volume_id" {
  description = "Production block volume ID"
  value       = module.host.volume_id
}

output "firewall_id" {
  description = "Production firewall ID"
  value       = module.host.firewall_id
}
