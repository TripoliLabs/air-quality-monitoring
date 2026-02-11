# TimescaleDB Schema (Issue #4)

This project uses **TimescaleDB (Postgres 16)** for time-series air quality sensor readings.
Schema changes are managed via **TypeORM migrations** (we do NOT use `synchronize`).

## What gets created

### Extensions

- `uuid-ossp` (UUID generation)
- `timescaledb` (hypertables + continuous aggregates)
- `pg_trgm` (trigram text search for fuzzy matching)

### Tables

#### `sensors`

Metadata about physical devices.

**Columns:**
- `id` (UUID PK)
- `device_eui` (VARCHAR(16) UNIQUE NOT NULL) — LoRaWAN DevEUI
- `name` (VARCHAR(100), nullable)
- `latitude` (DECIMAL(10,8), nullable)
- `longitude` (DECIMAL(11,8), nullable)
- `neighborhood` (VARCHAR(100), nullable)
- `installed_at` (TIMESTAMPTZ, nullable)
- `is_active` (BOOLEAN, default TRUE)
- `created_at` (TIMESTAMPTZ, default NOW())

**Indexes:**
- `sensors_name_trgm_idx` (GIN trigram index on `name`) — for fuzzy text search
- `sensors_neighborhood_trgm_idx` (GIN trigram index on `neighborhood`) — for fuzzy text search

#### `readings` (TimescaleDB hypertable)

Time-series measurements (hypertable partitioned by `time`).

**Columns:**
- `time` (TIMESTAMPTZ NOT NULL) — **partitioning column**
- `sensor_id` (UUID FK → sensors.id)
- `pm2_5` (REAL) — PM2.5 particulate matter (µg/m³)
- `pm10` (REAL) — PM10 particulate matter (µg/m³)
- `temperature` (REAL) — Temperature (°C)
- `humidity` (REAL) — Relative humidity (%)
- `pressure` (REAL) — Atmospheric pressure (hPa)
- `aqi` (INT) — Air Quality Index
- `battery_mv` (INT) — Battery voltage (millivolts)
- `rssi` (INT) — Signal strength (dBm)

**Notes (important for TimescaleDB):**
- The `readings` table intentionally has **no single-column PRIMARY KEY**.
  TimescaleDB requires the partitioning column (`time`) to be included in any UNIQUE/PK definition.

**Hypertable settings:**
- `chunk_time_interval`: **1 day**

**Indexes:**
- `readings_sensor_time_idx` (B-tree on `sensor_id`, `time DESC`) — for efficient time-range queries per sensor

### Continuous Aggregates

Two continuous aggregate materialized views for pre-computed rollups:

#### `readings_hourly` (bucket = 1 hour)
#### `readings_daily` (bucket = 1 day)

Each view contains:
- `bucket` (TIMESTAMPTZ) — time bucket start
- `sensor_id` (UUID)
- `avg_pm2_5` (REAL)
- `avg_pm10` (REAL)
- `avg_temperature` (REAL)
- `avg_humidity` (REAL)
- `avg_pressure` (REAL)
- `max_aqi` (INT) — maximum AQI in bucket
- `avg_battery_mv` (REAL)
- `avg_rssi` (REAL)
- `samples` (BIGINT) — number of readings in bucket

**Refresh policies:**
- **Hourly aggregate**: refresh last **2 days** every **15 minutes**, excluding the last **1 hour**
- **Daily aggregate**: refresh last **30 days** every **1 hour**, excluding the last **1 day**

### Retention Policy

- **Raw readings retention**: drop chunks older than **90 days**
  (`add_retention_policy('readings', INTERVAL '90 days')`)
- Continuous aggregates are retained indefinitely (configurable in future migrations)

---

## Running Locally (Docker)

From repo root:

```bash
# Start all services
docker compose up -d

# Run migrations
docker compose exec backend bun run migration:run

# Connect to database
docker compose exec timescaledb psql -U airquality -d airquality
```

### Verify TimescaleDB setup

```sql
-- Check hypertables
SELECT * FROM timescaledb_information.hypertables;

-- Check continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;

-- Check background jobs (refresh policies, retention)
SELECT * FROM timescaledb_information.jobs;

-- Check chunks
SELECT * FROM timescaledb_information.chunks;
```

---

## Seed Data for Development

The project includes safe, idempotent seed data in `database/init/`:

- **`01-extensions.sql`** - Enables PostgreSQL extensions (runs automatically)
- **`02-seed-dev.sh`** - Conditional seeding script (runs only if `SEED_DEV=1`)
- **`seed-dev.sql`** - Sample sensors + 3 days of synthetic readings

### Enable Seeding (Windows note)

On Windows, make sure `database/init/02-seed-dev.sh` uses **LF** line endings.

If the file gets converted to **CRLF**, you may see errors like:

- `/usr/bin/env: 'bash\r': No such file or directory`
- `bad interpreter: /usr/bin/env^M`

The first line must be:

```bash
#!/usr/bin/env bash
```
NOT:
```bash
#!/usr/bin/env^M bash
```
Set seed dev in docker-compose.yml to:
```bash
SEED_DEV=1
```

Then restart the database:

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bun run migration:run
```

### Manual Seeding

If you want to seed after migrations have already run:

```bash
docker compose exec -T timescaledb psql -U airquality -d airquality < database/init/seed-dev.sql
```

### What Gets Seeded

- **3 sensors** in Tripoli, Lebanon neighborhoods:
  - Downtown Station 1 (Tripoli Downtown)
  - Port Area Monitor (Mina Port)
  - School Sensor (Abou Samra)
- **~144 readings per sensor** (3 days × 48 readings/day at 30-min intervals)
- All data is synthetic with realistic values:
  - PM2.5: 8-20 µg/m³
  - PM10: 15-33 µg/m³
  - Temperature: 18-28°C
  - Humidity: 40-70%
  - Pressure: 1008-1018 hPa
  - AQI: 40-160
  - Battery: 3700-4000 mV
  - RSSI: -95 to -75 dBm

---

## Creating New Migrations

### Generate a migration from entity changes

```bash
cd backend
bun run migration:generate -- src/database/migrations/DescriptiveName
```

### Create an empty migration

```bash
cd backend
bun run migration:create -- src/database/migrations/DescriptiveName
```

### Run pending migrations

```bash
cd backend
bun run migration:run
```

### Revert the last migration

```bash
cd backend
bun run migration:revert
```

### Show migration status

```bash
cd backend
bun run migration:show
```

---

## Migration Best Practices

1. **Always use `IF NOT EXISTS`** or `IF EXISTS` for idempotency
2. **Test both `up()` and `down()` methods** before committing
3. **Never modify existing migrations** that have been deployed to production
4. **Use transactions** - TypeORM wraps migrations in transactions automatically
5. **Document breaking changes** in migration comments
6. **Include data migrations** if schema changes require backfilling

---

## Troubleshooting

### Migration fails with "relation already exists"

Migrations are idempotent (use `IF NOT EXISTS`). If you need to reset:

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bun run migration:run
```

### Check if TimescaleDB is working

```sql
-- Show TimescaleDB version
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';

-- List all hypertables
SELECT * FROM timescaledb_information.hypertables;

-- Show continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;

-- Show background jobs
SELECT job_id, proc_name, schedule_interval, next_start 
FROM timescaledb_information.jobs;
```

### Seed data not appearing

1. Ensure migrations have run first:
   ```bash
   docker compose exec backend bun run migration:run
   ```

2. Check if `SEED_DEV=1` in your `.env` file

3. Run seed manually:
   ```bash
   docker compose exec -T timescaledb psql -U airquality -d airquality < database/init/seed-dev.sql
   ```

4. Verify seed data:
   ```sql
   SELECT count(*) FROM sensors;
   SELECT count(*) FROM readings;
   ```

### Continuous aggregates not refreshing

Check refresh policies:

```sql
SELECT * FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_refresh_continuous_aggregate';
```

Manually refresh:

```sql
CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);
CALL refresh_continuous_aggregate('readings_daily', NULL, NULL);
```

### Retention policy not working

Check retention jobs:

```sql
SELECT * FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_retention';
```

Manually run retention:

```sql
SELECT drop_chunks('readings', INTERVAL '90 days');
```

---

