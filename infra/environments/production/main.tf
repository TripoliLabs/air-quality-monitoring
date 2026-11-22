terraform {
  required_version = ">= 1.6.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }

  # OpenTofu native S3 state backend with locking (use_lockfile = true) and bucket versioning.
  # For Hetzner Object Storage / AWS S3:
  # Provide backend config values via `-backend-config=backend.production.tfvars` or environment variables:
  #   tofu init -backend-config="bucket=aq-opentofu-state" \
  #             -backend-config="key=production/terraform.tfstate" \
  #             -backend-config="region=eu-central" \
  #             -backend-config="endpoint=https://fsn1.your-objectstorage.com"
  backend "s3" {
    key          = "production/terraform.tfstate"
    use_lockfile = true # OpenTofu native S3 locking via conditional writes
    encrypt      = true
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

module "host" {
  source = "../../modules/hetzner_host"

  environment        = "production"
  server_type        = var.server_type
  location           = var.location
  image              = var.image
  volume_size        = var.volume_size
  ssh_keys           = var.ssh_keys
  allowed_ssh_ips    = var.allowed_ssh_ips
  tailscale_auth_key = var.tailscale_auth_key
  domain_name        = var.domain_name
}
