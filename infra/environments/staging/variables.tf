variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "server_type" {
  description = "Hetzner Cloud server type"
  type        = string
  default     = "cx32"
}

variable "location" {
  description = "Hetzner Cloud datacenter location"
  type        = string
  default     = "fsn1"
}

variable "image" {
  description = "Operating system image"
  type        = string
  default     = "ubuntu-24.04"
}

variable "volume_size" {
  description = "Size in GB of attached persistent block volume"
  type        = number
  default     = 50
}

variable "ssh_keys" {
  description = "List of SSH key names or IDs registered in Hetzner Cloud"
  type        = list(string)
  default     = []
}

variable "allowed_ssh_ips" {
  description = "Allowed CIDRs for direct SSH access on port 22"
  type        = list(string)
  default     = []
}

variable "tailscale_auth_key" {
  description = "Optional Tailscale auth key for joining the staging host to Tailnet"
  type        = string
  default     = ""
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for staging (e.g. staging.aq.tripolilabs.org)"
  type        = string
  default     = "staging.aq.tripolilabs.org"
}
