variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "server_type" {
  description = "Hetzner Cloud server type (e.g. cx42 with 8 vCPU, 16GB RAM)"
  type        = string
  default     = "cx42"
}

variable "location" {
  description = "Hetzner Cloud datacenter location (e.g. fsn1, nbg1, hel1)"
  type        = string
  default     = "fsn1"
}

variable "image" {
  description = "Operating system image"
  type        = string
  default     = "ubuntu-24.04"
}

variable "volume_size" {
  description = "Size in GB of attached persistent block storage volume"
  type        = number
  default     = 100
}

variable "ssh_keys" {
  description = "List of SSH key names or IDs registered in Hetzner Cloud for root access"
  type        = list(string)
  default     = []
}

variable "allowed_ssh_ips" {
  description = "List of IPv4/IPv6 CIDRs allowed to access SSH on port 22 directly"
  type        = list(string)
  default     = []
}

variable "tailscale_auth_key" {
  description = "Optional Tailscale auth key to join the host to a private Tailnet for CI/CD access"
  type        = string
  default     = ""
  sensitive   = true
}

variable "domain_name" {
  description = "Root domain name for application services (e.g. aq.tripolilabs.org)"
  type        = string
  default     = ""
}
