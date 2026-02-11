import { MigrationInterface, QueryRunner } from 'typeorm';

export class Issue4TimescaleSchema1707500000000 implements MigrationInterface {
  name = 'Issue4TimescaleSchema1707500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Create sensors table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sensors (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_eui varchar(16) UNIQUE NOT NULL,
        name varchar(100),
        latitude decimal(10, 8),
        longitude decimal(11, 8),
        neighborhood varchar(100),
        installed_at timestamptz,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT NOW()
      );
    `);

    // Trigram indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS sensors_name_trgm_idx
      ON sensors
      USING GIN (name gin_trgm_ops);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS sensors_neighborhood_trgm_idx
      ON sensors
      USING GIN (neighborhood gin_trgm_ops);
    `);


    // Create readings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS readings (
        time timestamptz NOT NULL,
        sensor_id uuid REFERENCES sensors(id),
        pm2_5 real,
        pm10 real,
        temperature real,
        humidity real,
        pressure real,
        aqi integer,
        battery_mv integer,
        rssi integer
      );
    `);

    // Convert readings to hypertable
    await queryRunner.query(`
      SELECT create_hypertable(
        'readings',
        'time',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );
    `);


     // Continuous aggregates
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS readings_hourly
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket(INTERVAL '1 hour', time) AS bucket,
        sensor_id,
        AVG(pm2_5) AS avg_pm2_5,
        AVG(pm10) AS avg_pm10,
        AVG(temperature) AS avg_temperature,
        AVG(humidity) AS avg_humidity,
        AVG(pressure) AS avg_pressure,
        MAX(aqi) AS max_aqi,
        AVG(battery_mv)::real AS avg_battery_mv,
        AVG(rssi)::real AS avg_rssi,
        COUNT(*) AS samples
      FROM readings
      GROUP BY bucket, sensor_id
      WITH NO DATA;
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS readings_daily
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket(INTERVAL '1 day', time) AS bucket,
        sensor_id,
        AVG(pm2_5) AS avg_pm2_5,
        AVG(pm10) AS avg_pm10,
        AVG(temperature) AS avg_temperature,
        AVG(humidity) AS avg_humidity,
        AVG(pressure) AS avg_pressure,
        MAX(aqi) AS max_aqi,
        AVG(battery_mv)::real AS avg_battery_mv,
        AVG(rssi)::real AS avg_rssi,
        COUNT(*) AS samples
      FROM readings
      GROUP BY bucket, sensor_id
      WITH NO DATA;
    `);

    // Refresh policies
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM timescaledb_information.jobs j
          WHERE j.proc_name = 'policy_refresh_continuous_aggregate'
            AND j.hypertable_name = 'readings_hourly'
        ) THEN
          PERFORM add_continuous_aggregate_policy(
            'readings_hourly',
            start_offset => INTERVAL '2 days',
            end_offset   => INTERVAL '1 hour',
            schedule_interval => INTERVAL '15 minutes'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM timescaledb_information.jobs j
          WHERE j.proc_name = 'policy_refresh_continuous_aggregate'
            AND j.hypertable_name = 'readings_daily'
        ) THEN
          PERFORM add_continuous_aggregate_policy(
            'readings_daily',
            start_offset => INTERVAL '30 days',
            end_offset   => INTERVAL '1 day',
            schedule_interval => INTERVAL '1 hour'
          );
        END IF;
      END $$;
    `);

    // Retention policy, keep raw readings 90 days
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM timescaledb_information.jobs j
          WHERE j.proc_name = 'policy_retention'
            AND j.hypertable_name = 'readings'
        ) THEN
          PERFORM add_retention_policy('readings', INTERVAL '90 days');
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove policies if they exist
    await queryRunner.query(`
      DO $$
      DECLARE job_id integer;
      BEGIN
        SELECT j.job_id INTO job_id
        FROM timescaledb_information.jobs j
        WHERE j.proc_name='policy_refresh_continuous_aggregate'
          AND j.hypertable_name='readings_hourly'
        LIMIT 1;
        IF job_id IS NOT NULL THEN PERFORM delete_job(job_id); END IF;

        job_id := NULL;
        SELECT j.job_id INTO job_id
        FROM timescaledb_information.jobs j
        WHERE j.proc_name='policy_refresh_continuous_aggregate'
          AND j.hypertable_name='readings_daily'
        LIMIT 1;
        IF job_id IS NOT NULL THEN PERFORM delete_job(job_id); END IF;

        job_id := NULL;
        SELECT j.job_id INTO job_id
        FROM timescaledb_information.jobs j
        WHERE j.proc_name='policy_retention'
          AND j.hypertable_name='readings'
        LIMIT 1;
        IF job_id IS NOT NULL THEN PERFORM delete_job(job_id); END IF;
      END $$;
    `);

    // Drop trigram indexes
    await queryRunner.query(`DROP INDEX IF EXISTS sensors_name_trgm_idx;`);
    await queryRunner.query(`DROP INDEX IF EXISTS sensors_neighborhood_trgm_idx;`);
    await queryRunner.query(`DROP INDEX IF EXISTS readings_sensor_time_idx;`);

    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS readings_hourly;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS readings_daily;`);
    await queryRunner.query(`DROP TABLE IF EXISTS readings CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sensors CASCADE;`);
  }
}