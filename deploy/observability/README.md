# Observability

OpenTelemetry from the services, collected by **Grafana Alloy**, into an
LGTM-style backend — the self-hosted stack locally, and **Grafana Cloud** on
staging/prod. The application code and the Alloy pipelines are identical across
environments; only Alloy's *exporters* change.

```
 api, ingestion ──OTLP traces──►┐
   (:9464 Prometheus metrics) ──►│  Grafana Alloy  ├─► Tempo   (traces)   / Grafana Cloud
   (container stdout logs)    ──►┘  (collector)    ├─► Prometheus (metrics)/ Grafana Cloud
                                                   └─► Loki   (logs)      / Grafana Cloud
```

- **Traces** — services export OTLP to Alloy (`OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318`).
- **Metrics** — each service exposes an OTel Prometheus endpoint on `:9464`
  (HTTP server latency, Node.js runtime, and a custom `readings_ingested_total`
  counter). Alloy scrapes them and remote-writes onward.
- **Logs** — Alloy tails container stdout/stderr and ships to Loki.

## Run locally

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318 docker compose --profile observability up -d
```

- **Grafana** → http://localhost:3002 (`admin` / `admin`) — datasources
  (Prometheus/Tempo/Loki), the **Air Quality — Services** dashboard, and the
  alert rules (*ingestion stalled*, *API 5xx*) are auto-provisioned. Traces and
  logs are explorable via Grafana → Explore.
- **Alloy UI** → http://localhost:12345 · **Prometheus** → http://localhost:9090

Files: `alloy/config.alloy` (local collector), `prometheus.yml`, `tempo.yml`,
`provisioning/` (Grafana datasources + dashboards + alerting).

## Grafana Cloud (staging / prod)

Same services, same Alloy pipelines — swap the mounted config and provide the
Cloud credentials. No self-hosted Grafana/Prometheus/Loki/Tempo needed; you view
everything in your Grafana Cloud stack.

1. Mount **`alloy/config.cloud.alloy`** at `/etc/alloy/config.alloy` instead of
   the local one.
2. Set the `GRAFANA_CLOUD_*` environment variables (from your Cloud stack's
   "Connections → Add data / OTLP / Prometheus / Loki" pages). These are managed
   as GitHub Environment secrets — see the tracking issue and the list below.

| Variable | What it is |
|---|---|
| `GRAFANA_CLOUD_API_TOKEN` | Cloud Access Policy token with metrics/logs/traces **write** scopes |
| `GRAFANA_CLOUD_TEMPO_ENDPOINT` | OTLP endpoint, e.g. `https://otlp-gateway-<zone>.grafana.net/otlp` |
| `GRAFANA_CLOUD_TEMPO_USER` | OTLP / stack instance id |
| `GRAFANA_CLOUD_PROM_URL` | Prometheus remote-write URL, e.g. `https://prometheus-<zone>.grafana.net/api/prom/push` |
| `GRAFANA_CLOUD_PROM_USER` | Prometheus instance id |
| `GRAFANA_CLOUD_LOKI_URL` | Loki push URL, e.g. `https://logs-<zone>.grafana.net/loki/api/v1/push` |
| `GRAFANA_CLOUD_LOKI_USER` | Loki instance id |

> The two Alloy configs are siblings — keep the three pipelines in sync; only the
> exporters differ.
