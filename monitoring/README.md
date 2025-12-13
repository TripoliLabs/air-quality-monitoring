# Monitoring

This directory contains Grafana dashboards and Prometheus configuration for system monitoring.

## Stack

- **Grafana** - Visualization and dashboards
- **Prometheus** - Metrics collection
- **Loki** - Log aggregation

## Dashboards

- `air-quality-overview.json` - Main dashboard showing all sensors
- `sensor-detail.json` - Detailed view for individual sensors
- `system-health.json` - Backend and infrastructure health

## Metrics Collected

### Application Metrics
- Sensor readings (PM2.5, PM10, temperature, humidity)
- AQI calculations
- API request latency
- MQTT message throughput

### Infrastructure Metrics
- Container resource usage (CPU, memory)
- Database connections and query performance
- Redis cache hit/miss rates
- LoRaWAN gateway statistics

## Setup

Grafana and Prometheus are included in the Docker Compose setup.

Access Grafana at: http://localhost:3001
- Default credentials: admin/admin

## Alerts

Configured alerts:
- Sensor offline for > 30 minutes
- AQI exceeds unhealthy threshold
- Low battery warning
- API error rate spike
