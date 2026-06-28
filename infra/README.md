# Infrastructure (OpenTofu — DigitalOcean)

Provisioning for the cloud stack. Provisioning (`infra/`) is separate from
deployment (`deploy/`).

```
infra/
├── modules/                 # reusable modules (droplet, managed-pg, spaces, vpc, dns)
└── environments/
    ├── staging/
    └── production/
```

- State: DigitalOcean Spaces (S3-compatible) with locking.
- The telemetry DB lives on **TigerData** (its own provider), outside the DO plane.
- See docs/architecture.md (ADR-001) for the two-database topology.
