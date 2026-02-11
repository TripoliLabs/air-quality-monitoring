-- Dev seed data (SAFE)
-- - If tables don't exist yet: do nothing (no error)
-- - sensors inserts are idempotent
-- - readings insert only happens if readings is empty

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sensors')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='readings') THEN
    RAISE NOTICE 'sensors/readings tables not found yet; skipping seed (run migrations first)';
    RETURN;
  END IF;
END $$;

-- sensors (matches your screenshot schema columns)
INSERT INTO sensors (device_eui, name, latitude, longitude, neighborhood, installed_at, is_active)
VALUES
  ('70B3D57ED006A1A1', 'Tripoli Center', 32.88720000, 13.19130000, 'Center',  now() - interval '30 days', true),
  ('70B3D57ED006A1A2', 'Airport',       32.89400000, 13.27700000, 'Airport', now() - interval '25 days', true),
  ('70B3D57ED006A1A3', 'Coastal Road',  32.80600000, 13.07500000, 'Coast',   now() - interval '20 days', true)
ON CONFLICT (device_eui) DO NOTHING;

-- readings (only if empty)
DO $$
DECLARE c bigint;
BEGIN
  SELECT count(*) INTO c FROM readings;
  IF c > 0 THEN
    RAISE NOTICE 'readings already has % rows; skipping seed readings', c;
    RETURN;
  END IF;

  INSERT INTO readings (
    time, sensor_id, pm2_5, pm10, temperature, humidity, pressure, aqi, battery_mv, rssi
  )
  SELECT
    gs AS time,
    s.id AS sensor_id,
    (8  + random()*12)::real    AS pm2_5,
    (15 + random()*18)::real    AS pm10,
    (18 + random()*10)::real    AS temperature,
    (40 + random()*30)::real    AS humidity,
    (1008 + random()*10)::real  AS pressure,
    (40 + random()*120)::int    AS aqi,
    (3700 + random()*300)::int  AS battery_mv,
    (-95 + random()*20)::int    AS rssi
  FROM sensors s
  CROSS JOIN generate_series(now() - interval '3 days', now(), interval '30 minutes') gs;
END $$;