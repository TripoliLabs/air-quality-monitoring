#!/usr/bin/env bash
#
# End-to-end smoke test for the local pipeline. Asserts that real (simulated)
# data flows: firmware → MQTT → ingestion → TimescaleDB + Redis → API (REST + WS).
# Requires the stack to be up (`docker compose up -d`).
#
# Usage: scripts/e2e-smoke.sh
set -uo pipefail

API="http://localhost:3000"
DEVEUI="70b3d57ed0060002"
fails=0

pass() { printf "  \033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; fails=$((fails + 1)); }

echo "== E2E smoke test =="

# 1) Sensors are seeded and served by the API.
count=$(curl -s -m 5 "$API/sensors" | grep -o '"deviceId"' | wc -l | tr -d ' ')
[ "$count" -ge 6 ] && pass "API /sensors returns $count sensors" || fail "expected >=6 sensors, got $count"

# 2) Readings are accumulating (the pipeline is live).
q="SELECT count(*) FROM readings;"
n0=$(docker exec airquality-timescaledb psql -U airquality -d telemetry -tAc "$q" 2>/dev/null)
sleep 20
n1=$(docker exec airquality-timescaledb psql -U airquality -d telemetry -tAc "$q" 2>/dev/null)
[ "${n1:-0}" -gt "${n0:-0}" ] && pass "readings growing ($n0 → $n1)" || fail "readings not growing ($n0 → $n1)"

# 3) Latest-value cache (Redis) is served by the API.
latest=$(curl -s -m 5 "$API/sensors/$DEVEUI/latest")
echo "$latest" | grep -q '"aqi"' && pass "API /sensors/$DEVEUI/latest returns a reading" || fail "no latest reading for $DEVEUI"

# 4) Time-series query (TimescaleDB) returns rows.
rcount=$(curl -s -m 5 "$API/sensors/$DEVEUI/readings?hours=24" | grep -o '"sensorId"' | wc -l | tr -d ' ')
[ "$rcount" -gt 0 ] && pass "API readings query returns $rcount rows" || fail "no readings returned"

# 5) Realtime: the WebSocket gateway emits live events.
events=$(node -e "
const { io } = require('$(pwd)/apps/dashboard/node_modules/socket.io-client');
const s = io('$API'); let n = 0;
s.on('reading', () => n++);
setTimeout(() => { console.log(n); s.close(); }, 15000);
" 2>/dev/null)
[ "${events:-0}" -gt 0 ] && pass "WebSocket delivered $events live events" || fail "no live WS events"

# 6) Continuous aggregate is functional.
docker exec airquality-timescaledb psql -U airquality -d telemetry -tAc \
  "CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);" >/dev/null 2>&1
agg=$(docker exec airquality-timescaledb psql -U airquality -d telemetry -tAc \
  "SELECT count(*) FROM readings_hourly;" 2>/dev/null)
[ "${agg:-0}" -gt 0 ] && pass "continuous aggregate has $agg rows" || fail "continuous aggregate empty"

echo
if [ "$fails" -eq 0 ]; then
  printf "\033[32mE2E smoke test passed\033[0m\n"
  exit 0
else
  printf "\033[31mE2E smoke test FAILED (%d checks)\033[0m\n" "$fails"
  exit 1
fi
