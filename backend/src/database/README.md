# Backend database schema

This backend uses PostgreSQL + TimescaleDB through TypeORM migrations.

## Objects created by issue #4

### Extensions

- `timescaledb`
- `pg_trgm`

The Docker bootstrap script at `../../database/init/01-extensions.sql` enables both extensions for fresh local containers, and the migration also enables them so non-Docker environments stay reproducible.

### Tables

#### `sensors`

Stores static and operational metadata for each air-quality node.

Key columns:
- `id uuid primary key`
- `deviceId unique`
- `name`
- `description`
- `latitude`, `longitude`
- `neighborhood`
- `isActive`
- `lastSeenAt`
- `batteryMv`, `signalStrength`
- `createdAt`, `updatedAt`

Indexes:
- unique index on `deviceId`
- btree index on `("isActive", "lastSeenAt" desc)` for active/offline fleet views
- trigram GIN index on `lower(name)` for search
- trigram GIN index on `lower(neighborhood)` for neighborhood filtering/search

#### `readings`

Stores raw time-series measurements as a TimescaleDB hypertable.

Key columns:
- composite primary key on `(id, timestamp)`
- foreign key `sensorId -> sensors.id`
- particulate fields: `pm25`, `pm10`, `pm1`
- environmental fields: `temperature`, `humidity`, `pressure`
- derived AQI fields: `aqi`, `aqiCategory`
- metadata: `batteryMv`, `signalStrength`, `createdAt`

Hypertable configuration:
- time column: `timestamp`
- hash partition column: `sensorId`
- partitions: `4`
- chunk interval: `1 day`
- default Timescale indexes disabled in favor of explicit project indexes

Indexes:
- `("sensorId", "timestamp" desc)` for sensor history and latest-reading queries
- `("timestamp" desc)` for recent-network queries and ingestion monitoring

## Continuous aggregates

### `readings_hourly`

Hourly rollups per sensor with:
- averaged PM / temperature / humidity / pressure
- min/max AQI
- `sample_count`

Policy:
- refresh window: last 14 days
- end offset: 1 hour
- refresh cadence: every 15 minutes

### `readings_daily`

Daily rollups per sensor with the same aggregate fields.

Policy:
- refresh window: last 365 days
- end offset: 1 day
- refresh cadence: every hour

Both views are configured with `timescaledb.materialized_only = false`, so queries can include recent rows that have not been materialized yet.

## Retention

Raw `readings` keep 90 days of data:

```sql
SELECT add_retention_policy('readings', drop_after => INTERVAL '90 days');
```

Hourly and daily rollups are intended to preserve long-range history after raw chunks age out.

## Migrations and seed workflow

Run from `backend/`:

```bash
bun install
bun run db:migrate:run
bun run db:seed:dev
```

Useful commands:

```bash
bun run db:migrate:show
bun run db:migrate:revert
```

## Manual inspection queries

```sql
SELECT * FROM timescaledb_information.hypertables;
SELECT * FROM timescaledb_information.continuous_aggregates;
SELECT * FROM timescaledb_information.jobs ORDER BY hypertable_name NULLS LAST, proc_name;
SELECT * FROM readings_hourly ORDER BY bucket DESC LIMIT 10;
SELECT * FROM readings_daily ORDER BY bucket DESC LIMIT 10;
```
