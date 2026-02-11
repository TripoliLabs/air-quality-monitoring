#!/usr/bin/env bash
set -euo pipefail

# Only run seed when explicitly enabled
if [[ "${SEED_DEV:-0}" != "1" ]]; then
  echo "[seed] SEED_DEV is not 1; skipping dev seed."
  exit 0
fi

echo "[seed] SEED_DEV=1 → attempting dev seed (safe mode)..."

# Don’t fail DB init under any circumstances.
# Seed is expected to run only after migrations create tables.
psql -v ON_ERROR_STOP=0 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f /docker-entrypoint-initdb.d/seed-dev.sql \
  && echo "[seed] Dev seed executed successfully." \
  || true

echo "[seed] If tables did not exist yet, seed was skipped safely."
echo "[seed] After running migrations you can run manually:"
echo "       docker compose exec -T timescaledb psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < database/init/seed-dev.sql"