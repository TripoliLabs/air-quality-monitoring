-- Custom TimescaleDB migration (features no ORM can model).
-- Runs after 0000 created the `readings` table.

-- 1) Convert `readings` into a hypertable partitioned on `time`.
--    The composite PK (sensor_id, time) already includes the partition column.
SELECT create_hypertable('readings', by_range('time', INTERVAL '7 days'));
--> statement-breakpoint

-- 2) Continuous aggregate: hourly per-sensor rollup for fast dashboard queries.
CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    sensor_id,
    time_bucket(INTERVAL '1 hour', "time") AS bucket,
    avg(pm25)        AS avg_pm25,
    avg(pm10)        AS avg_pm10,
    avg(temperature) AS avg_temperature,
    avg(humidity)    AS avg_humidity,
    max(aqi)         AS max_aqi,
    count(*)         AS sample_count
FROM readings
GROUP BY sensor_id, bucket
WITH NO DATA;
--> statement-breakpoint

-- 3) Refresh policy for the continuous aggregate (keep the last hours fresh).
SELECT add_continuous_aggregate_policy('readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes');
--> statement-breakpoint

-- 4) Columnar compression: compress chunks older than 7 days, segmented by sensor.
ALTER TABLE readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'sensor_id',
    timescaledb.compress_orderby = 'time DESC'
);
--> statement-breakpoint
SELECT add_compression_policy('readings', INTERVAL '7 days');
--> statement-breakpoint

-- 5) Retention: drop raw readings older than 1 year (the continuous aggregate keeps long-term trends).
SELECT add_retention_policy('readings', INTERVAL '365 days');
