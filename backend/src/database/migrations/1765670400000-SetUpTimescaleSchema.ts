import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SetUpTimescaleSchema1765670400000 implements MigrationInterface {
  public readonly name = 'SetUpTimescaleSchema1765670400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sensors (
        id uuid NOT NULL,
        "deviceId" VARCHAR(16) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description text,
        latitude numeric(10,7) NOT NULL,
        longitude numeric(10,7) NOT NULL,
        neighborhood VARCHAR(100),
        "isActive" boolean NOT NULL DEFAULT true,
        "lastSeenAt" timestamptz,
        "batteryMv" integer,
        "signalStrength" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sensors_id" PRIMARY KEY (id),
        CONSTRAINT "UQ_sensors_deviceId" UNIQUE ("deviceId")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sensors_isActive_lastSeenAt"
      ON sensors ("isActive", "lastSeenAt" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sensors_name_trgm"
      ON sensors USING gin (LOWER(name) gin_trgm_ops);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sensors_neighborhood_trgm"
      ON sensors USING gin (LOWER(neighborhood) gin_trgm_ops)
      WHERE neighborhood IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id uuid NOT NULL,
        "sensorId" uuid NOT NULL,
        "timestamp" timestamptz NOT NULL,
        pm25 numeric(6,2) NOT NULL,
        pm10 numeric(6,2) NOT NULL,
        pm1 numeric(6,2),
        temperature numeric(5,2) NOT NULL,
        humidity numeric(5,2) NOT NULL,
        pressure numeric(7,2),
        aqi integer NOT NULL,
        "aqiCategory" character varying(32),
        "batteryMv" integer,
        "signalStrength" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_readings_id_timestamp" PRIMARY KEY (id, "timestamp"),
        CONSTRAINT "FK_readings_sensorId" FOREIGN KEY ("sensorId") REFERENCES sensors(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      SELECT create_hypertable(
        'readings',
        'timestamp',
        chunk_time_interval => INTERVAL '1 day',
        create_default_indexes => FALSE,
        if_not_exists => TRUE
);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_readings_sensor_timestamp_desc"
      ON readings ("sensorId", "timestamp" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_readings_timestamp_desc"
      ON readings ("timestamp" DESC);
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW readings_hourly
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket(INTERVAL '1 hour', "timestamp") AS bucket,
        "sensorId" AS sensor_id,
        AVG(pm25)::numeric(6,2) AS avg_pm25,
        AVG(pm10)::numeric(6,2) AS avg_pm10,
        AVG(pm1)::numeric(6,2) AS avg_pm1,
        AVG(temperature)::numeric(5,2) AS avg_temperature,
        AVG(humidity)::numeric(5,2) AS avg_humidity,
        AVG(pressure)::numeric(7,2) AS avg_pressure,
        MAX(aqi) AS max_aqi,
        MIN(aqi) AS min_aqi,
        COUNT(*)::bigint AS sample_count
      FROM readings
      GROUP BY 1, 2
      WITH NO DATA;
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW readings_daily
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket(INTERVAL '1 day', "timestamp") AS bucket,
        "sensorId" AS sensor_id,
        AVG(pm25)::numeric(6,2) AS avg_pm25,
        AVG(pm10)::numeric(6,2) AS avg_pm10,
        AVG(pm1)::numeric(6,2) AS avg_pm1,
        AVG(temperature)::numeric(5,2) AS avg_temperature,
        AVG(humidity)::numeric(5,2) AS avg_humidity,
        AVG(pressure)::numeric(7,2) AS avg_pressure,
        MAX(aqi) AS max_aqi,
        MIN(aqi) AS min_aqi,
        COUNT(*)::bigint AS sample_count
      FROM readings
      GROUP BY 1, 2
      WITH NO DATA;
    `);

    await queryRunner.query(`
      ALTER MATERIALIZED VIEW readings_hourly
      SET (timescaledb.materialized_only = false);
    `);

    await queryRunner.query(`
      ALTER MATERIALIZED VIEW readings_daily
      SET (timescaledb.materialized_only = false);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_readings_hourly_sensor_bucket_desc"
      ON readings_hourly (sensor_id, bucket DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_readings_daily_sensor_bucket_desc"
      ON readings_daily (sensor_id, bucket DESC);
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy(
        'readings_hourly',
        start_offset => INTERVAL '14 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '15 minutes'
      );
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy(
        'readings_daily',
        start_offset => INTERVAL '365 days',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 hour'
      );
    `);

    await queryRunner.query(`
      SELECT add_retention_policy(
        'readings',
        drop_after => INTERVAL '90 days'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT remove_retention_policy('readings');`);
    await queryRunner.query(`SELECT remove_continuous_aggregate_policy('readings_daily');`);
    await queryRunner.query(`SELECT remove_continuous_aggregate_policy('readings_hourly');`);

    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS readings_daily;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS readings_hourly;`);
    await queryRunner.query(`DROP TABLE IF EXISTS readings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sensors;`);
  }
}
