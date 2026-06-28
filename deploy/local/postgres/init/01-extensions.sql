-- Init script for the RELATIONAL app database (normal PostgreSQL).
-- Runs once on first container start, before any app migrations.
--
-- pg_trgm is required by ChirpStack (trigram search on device/gateway names).
-- The telemetry database runs on the TimescaleDB image, which auto-creates the
-- `timescaledb` extension in its own database — it is intentionally NOT created
-- here, since this script targets plain PostgreSQL where that extension is absent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
