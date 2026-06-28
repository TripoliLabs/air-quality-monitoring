# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-source distributed air quality monitoring network for Tripoli, Lebanon using solar-powered LoRaWAN sensors to measure PM2.5, PM10, temperature, and humidity.

**Organization:** TripoliLabs
**License:** AGPL-3.0 (keeps project open source forever, prevents closed-source SaaS exploitation)
**Status:** Monorepo restructure complete. The dashboard is built (runs on mock data); api/ingestion and shared packages are fresh, compiling scaffolds wired together (codec → contracts → domain → db). Next: real schema/migrations, then feature work.

> **Canonical architecture & decisions:** see [`docs/architecture.md`](docs/architecture.md)
> for the monorepo layout and the adopted ADRs (two-DB topology, Drizzle, Zod
> contracts, pnpm+Node, Biome/ESLint split).

## Architecture Overview

### System Data Flow

```
ESP32 Sensors → LoRaWAN Gateway → ChirpStack → MQTT
                                                 ↓
                                    ┌────────────────────────┐
                                    │   NestJS Ingestion     │
                                    └───────────┬────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ↓                     ↓                     ↓
                   TigerData             Redis Pub/Sub          Redis Cache
                   (TimescaleDB:         (real-time events)     (latest values)
                    readings)                  ↓
                          ↑            NestJS WebSocket Gateway
                          │                     ↓
   DO Managed Postgres ───┤  NestJS REST API ←── Vue.js Dashboard
   (relational metadata) ─┘  (reads both DBs; metadata joined in app layer)
```

**Data paths:**
- **Historical queries:** Vue.js → REST API → TigerData (telemetry) + DO Managed Postgres (metadata)
- **Real-time updates:** Redis Pub/Sub → WebSocket Gateway → Vue.js (Socket.IO)
- **Latest values:** Vue.js → REST API → Redis Cache

> **Two managed databases** (see ADR-001): time-series readings live on **TigerData**
> (managed TimescaleDB, full TSL — compression/continuous-aggregates/retention);
> relational app data + ChirpStack state live on **DO Managed Postgres**. They do
> not cross-join natively — readings are enriched with metadata in the app layer.

### Technology Stack

**Runtime:** Node.js 24+ LTS (Krypton) — services run on Node, *not* the Bun runtime (ADR-003)
**Language:** TypeScript 5.9+
**Firmware:** C++ with ESP-IDF 5.x + PlatformIO (ESP32)
**Network Server:** ChirpStack v4 (self-hosted LoRaWAN network server)
**Message Broker:** EMQX (production) · NanoMQ (local dev) — identical MQTT contract
**Backend:** NestJS 11+ (modular Node.js framework)
**Telemetry DB:** TigerData / Tiger Cloud — managed TimescaleDB, full TSL edition (compression, continuous aggregates, retention)
**Relational DB:** DigitalOcean Managed PostgreSQL 16 (app data + ChirpStack state)
**DB access:** Drizzle ORM (both DBs; `--custom` SQL migrations for Timescale DDL) (ADR-001)
**API contracts:** Zod 4 (shared package) + nestjs-zod → auto OpenAPI (ADR-002)
**Cache/PubSub:** Redis 7.x (caching + Pub/Sub for real-time WebSocket broadcast)
**Frontend:** Vue.js 3.5+ + Vite 7+ + Tailwind CSS
**Maps:** MapLibre GL JS 4+ + OpenStreetMap tiles (open source, no API keys)
**Charts:** Apache ECharts (better for real-time time-series data)
**Observability:** Grafana LGTM stack (Loki, Grafana, Tempo, Mimir) + Prometheus + OpenTelemetry
**Orchestration:** Docker Compose (local) · OpenTofu on DigitalOcean (cloud)

### Tooling

**Package Manager:** pnpm 11+ (strict node_modules, catalogs, best-in-class Docker caching) (ADR-003)
**Monorepo:** Turborepo (task graph + caching, affected-graph CI)
**Backend Linting:** Biome 2.5+ (Rust-based, type-aware lint + formatter, replaces ESLint + Prettier)
**Frontend Linting:** ESLint 9+ with eslint-plugin-vue (only tool with real Vue template analysis)
**Frontend Formatting:** Prettier with prettier-plugin-tailwindcss
**Git Hooks:** Lefthook (Go-based, fast parallel execution)
**CI:** GitHub Actions (Turbo affected-graph)
**C++ Build:** PlatformIO (ESP32 ecosystem) + xmake (for dependencies)

> Bun is *not* used to install or run code (ADR-003). It may optionally be used as a fast test runner (`bun test`) on shared packages.

### Hardware

**Microcontroller:** LILYGO T-Beam V1.2 868MHz (ESP32 + LoRa + GPS + OLED) - $29-32
**PM Sensor:** Plantower PMS7003 - $11.50-12
**Environment Sensor:** BME280 (temperature/humidity/pressure) - $2.50-3
**Power:** 5V 2W USB Solar Panel + Samsung INR18650-30Q 3000mAh + TP4056 charger
**Gateways:** RAK7268 WisGate Edge Lite 2 (8-ch SX1302) - $139-180
**Enclosure:** SZOMK IP67 Waterproof Box (130×90×25mm)
**Node Cost:** ~$56-65 per sensor node

## Project Structure

pnpm + Turborepo monorepo. The frontend is the only pre-existing app (moved from
`frontend/`); api/ingestion and the shared packages are fresh scaffolds.

```
air-quality-monitoring/
├── apps/
│   ├── dashboard/         # Vue 3 + Vite SPA  (@aq/dashboard, ESLint+Prettier)
│   └── api/               # NestJS public REST + WS  (@aq/api, Biome)
├── services/
│   ├── ingestion/         # NestJS MQTT pipeline  (@aq/ingestion, Biome)
│   └── simulator/         # simulated LoRaWAN deployment — runs the firmware per node (@aq/simulator)
├── packages/              # shared TypeScript libraries (built to dist/ via tsc)
│   ├── domain/            # @aq/domain — AQI calc, units, core types
│   ├── contracts/         # @aq/contracts — Zod schemas (DTOs + events)
│   ├── db/                # @aq/db — Drizzle: relational + telemetry clients/schema
│   ├── telemetry-codec/   # @aq/telemetry-codec — LoRa payload spec + decoder
│   └── observability/     # @aq/observability — logger / OTel init
├── firmware/              # ESP32 firmware (ports & adapters)
│   ├── core/              #   portable C: sensor HAL + payload codec (host- & target-buildable)
│   ├── sim/               #   host adapter: simulated PMS7003/BME280 + entrypoint (used by the simulator)
│   ├── adapters/esp32/    #   on-target drivers (PMS7003/BME280/LoRa)
│   ├── test/              #   host unit tests (make test)
│   └── platformio.ini     #   ESP-IDF build
├── edge/
│   └── chirpstack/        # ChirpStack v4 config (gateway)
├── infra/                 # OpenTofu (DigitalOcean) — modules/ + environments/
├── deploy/
│   ├── observability/     # LGTM stack configs (Prometheus, Grafana provisioning)
│   └── onprem/            # gateway-box provisioning (ansible/cloud-init)
├── database/init/         # local Postgres init (pg_trgm for ChirpStack)
├── mqtt/                  # local NanoMQ config
├── hardware/ · docs/      # BOMs / documentation
├── turbo.json · tsconfig.base.json · biome.json · pnpm-workspace.yaml
└── docker-compose.yml     # local full-stack (data plane + api/ingestion/dashboard)
```

Package scope is `@aq/*` (placeholder — may become `@tripolilabs/*`). Shared
packages compile to `dist/`; Turbo builds them before the apps that depend on them.

## Development Commands

### Firmware (ESP32)

```bash
cd firmware
pio run                    # Build firmware
pio run --target upload    # Flash to ESP32
pio device monitor         # View serial output
pio test                   # Run tests
```

### Monorepo (pnpm + Turborepo, from the repo root)

```bash
pnpm install                                   # install the whole workspace
pnpm build                                     # turbo: build all packages + apps (in dep order)
pnpm typecheck                                 # turbo: typecheck across the workspace
pnpm lint                                      # turbo: Biome (backend) + ESLint (dashboard)

# Run a single app/service (Node runtime, hot reload):
pnpm --filter @aq/api start:dev                # NestJS API        → :3000
pnpm --filter @aq/ingestion start:dev          # ingestion worker  → :3001
pnpm --filter @aq/dashboard dev                # Vue dashboard     → :5173

# Work on one package:
pnpm --filter @aq/domain build                 # build a single package
pnpm --filter @aq/api exec biome check src     # Biome on the API
```

Packages compile to `dist/` and apps import them from there, so build the
packages before running an app on the host (`pnpm build`, or rely on Turbo).

### Testing

```bash
pnpm test                                      # unit tests (Vitest): @aq/domain, @aq/telemetry-codec, @aq/contracts
make -C firmware test                          # firmware C unit tests (host, gcc)
bash scripts/e2e-smoke.sh                       # end-to-end smoke test (requires the stack up)

# Integration tests (require `docker compose up -d`):
pnpm --filter @aq/api run test:integration       # API endpoints against the live stack
pnpm --filter @aq/ingestion run test:integration # publish an uplink → assert decode/persist/cache
```

### Local simulation (runs on real, firmware-produced data)

`docker compose up -d` runs the whole pipeline live: the **`simulator`** spawns the
node **firmware host build** (`firmware/build/aq-node-sim`, the real C sampling +
payload-encode code with simulated PMS7003/BME280 drivers) per node, wraps each
payload in a ChirpStack uplink, and publishes to MQTT → ingestion decodes
(`@aq/telemetry-codec`) → TimescaleDB + Redis → API (REST + Socket.IO) → dashboard.
The dashboard reads the backend through `apps/dashboard/src/services` (HTTP + WS),
or falls back to the in-browser mock when `VITE_API_URL` is unset.

### Docker (local dev backing services)

The root `docker-compose.yml` spins up the backing services; run the apps on the
host (`pnpm dev`) for hot-reload. Uses profiles to keep the default lean.

```bash
docker compose up -d                              # full stack: data plane + migrate (one-shot) + api/ingestion/dashboard + simulator
docker compose --profile observability up -d      # + Grafana / Prometheus / Loki
docker compose logs -f ingestion                  # watch readings being ingested
docker compose up -d --scale simulator=0          # run without the traffic simulator
docker compose down                               # Stop (add -v to wipe volumes + DB schema)
```

On `up`, the one-shot **`migrate`** service applies both DBs' migrations (incl. the
custom TimescaleDB hypertable/continuous-aggregate/compression/retention SQL) and
seeds the sensor fixtures, then api/ingestion start. The **`simulator`** emits
realistic ChirpStack uplinks for the fixture nodes, so the pipeline runs on live
data (simulator → NanoMQ → ingestion → TimescaleDB + Redis → API).

Local Postgres (5432) is the relational stand-in for DO Managed Postgres;
local TimescaleDB (5439) is the full-TSL stand-in for TigerData.

### Pre-commit Hooks (Lefthook)

Git hooks are managed by [lefthook](https://github.com/evilmartians/lefthook) and installed automatically via `pnpm install` in the root directory.

**Pre-commit hooks (run in parallel):**
- `backend-lint`: Biome check with auto-fix on `apps/api`, `services/*`, `packages/*`
- `dashboard-lint`: ESLint with auto-fix on `apps/dashboard` (`.ts`, `.js`, `.vue`)
- `dashboard-format`: Prettier formatting on `apps/dashboard`
- `secrets`: Scans for hardcoded credentials (disabled by default)

**Commit-msg hook:**
- Enforces [Conventional Commits](https://www.conventionalcommits.org/) format
- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`

**Pre-push hooks:** (disabled for now, CI runs tests)
- `backend-test`: Runs backend tests before push
- `frontend-test`: Runs frontend tests before push

**Manual commands:**
```bash
lefthook run pre-commit            # Run on staged files
lefthook run pre-commit --all      # Run on all files
lefthook install                   # Reinstall hooks
```

### CI (GitHub Actions)

CI is configured in `.github/workflows/ci.yml` as a single job that installs the
workspace and runs Turbo across it: `pnpm install` → `pnpm lint` → `pnpm typecheck`
→ `pnpm build`. Turbo runs each task in dependency order and caches unchanged
packages, so only what actually changed is rebuilt.

> **Note:** Docker build and integration tests will be added when deployment infrastructure is set up.

## Key Design Decisions

### Why LoRaWAN (not WiFi)?
- Works during Lebanon's frequent power outages (20+ hours/day)
- Long range (5-10km) reduces gateway infrastructure needs
- Low power consumption (battery lasts months)
- Only gateways need internet connection

### Why Self-hosted ChirpStack?
- Full control over sensor data and privacy
- No cloud dependencies (critical in Lebanon's infrastructure context)
- Cost-effective at scale (200+ sensors)
- Can operate offline if needed

### Why TimescaleDB (hosted on TigerData)?
- 10-100x compression on time-series data
- Continuous aggregates (auto-updating materialized views)
- Real PostgreSQL (relational + time-series in one engine)
- Automatic retention policies for data cleanup
- **Hosting:** these TSL features require **TigerData** (managed) or self-hosting —
  DO Managed Postgres ships the **Apache-2.0 edition only**, where compression,
  continuous aggregates, and retention error out. Hence the two-DB split (ADR-001).

### Why two separate databases? (ADR-001)
- DO Managed Postgres can't run the required Timescale TSL features → telemetry
  must go to TigerData; relational data is happy (and cheaper, managed-HA) on DO.
- Also isolates ingestion write-load from app reads, with independent scaling/backups.

### Why EMQX (prod) / NanoMQ (local)?
- **EMQX** in production: cloud-native, scalable, MQTT 5.0, free tier fits project scale.
- **NanoMQ** for local dev: lightweight C/NNG broker, tiny footprint, same MQTT
  contract (same EMQ ecosystem) so app code is identical across both.

### Why Drizzle ORM? (ADR-001)
- One tool for **both** databases (no mixing query libraries); best Node/Bun story.
- Schema-in-TS + relational query API for app data; `--custom` SQL migrations cleanly
  express Timescale DDL (hypertables, continuous aggregates, compression/retention).
- TypeORM rejected (weak inference; its `@timescaledb/typeorm` helper is abandoned at v0.0.1);
  Prisma rejected (weak Timescale fit); Kysely rejected (no schema/migrations of its own).

### Why MapLibre GL JS + OpenStreetMap (not Mapbox)?
- MapLibre is open source fork of Mapbox GL v1 (before license change)
- OpenStreetMap tiles are free with no API keys or usage limits
- WebGL rendering for smooth performance with 100+ sensor markers
- Aligns with AGPL-3.0 ethos and civic tech values
- Perfect for projects requiring full control and transparency

### Why Apache ECharts (not Chart.js)?
- Better performance with large time-series datasets (incremental rendering)
- Built-in support for real-time streaming data without full redraws
- More polished appearance out of the box
- Better zoom/brush interactions for time-series exploration
- Tree-shakeable (~100KB but only import what you need)
- Maintained by Apache Foundation

### Why pnpm + Node (not Bun)? (ADR-003)
- **pnpm** to install: strict non-flat `node_modules` (phantom-dep protection),
  catalogs to pin shared versions, best-in-class Docker layer caching, `turbo prune`.
- **Node LTS** to run: our stack hits the Bun runtime's 2026 soft spots —
  mqtt.js-over-TLS, ioredis, ORM-under-SWC, and long-uptime memory in the 24/7
  ingestion service; NestJS has no official Bun support. The runtime speed edge is
  irrelevant when the bottleneck is DB/Redis/MQTT I/O.
- **Bun** stays optional as a fast test runner (`bun test`) on shared packages.

### Why Biome (Backend)?
- 30x faster than ESLint + Prettier combined; single tool for lint AND format
- Built in Rust; type-aware linting since v2 (no `tsc` needed)
- Works well for pure TypeScript (NestJS backend) — formats decorators fine

### Why ESLint + Prettier (Frontend)?
- `eslint-plugin-vue` is the **only** tool with real `<script setup>`↔`<template>`
  cross-analysis (catches a var used in template but undeclared in script)
- Vue-specific rules (component naming, props/emits declarations)
- Mature Vue 3 + TypeScript ecosystem
- As of 2026, Biome and oxlint still don't parse Vue templates → ESLint stays for the frontend

### Why Lefthook?
- Written in Go, extremely fast startup (no Node.js overhead)
- Parallel hook execution (runs backend and frontend checks simultaneously)
- Works great in monorepos with `root:` directive for subdirectories
- Simple YAML configuration
- Auto-staging of fixed files with `stage_fixed: true`
- No npm dependencies (standalone binary)

## Lebanon Context (Critical)

**Infrastructure Challenges:**
- Frequent power outages (20+ hours/day) - sensors must be solar powered
- Unreliable internet connectivity - LoRaWAN reduces dependency
- Limited government environmental monitoring - this fills the gap
- Illegal diesel generators are major pollution source

**Social Impact:**
- This is a civic tech / social impact project
- Open source values are core to the mission
- Community engagement is as important as technical execution
- Cost optimization matters (nonprofit/community project)
- Bilingual support needed (Arabic + English)
- Security/anti-theft considerations for outdoor installations

## Development Guidelines

### Code Style

**TypeScript (Backend):**
- Use Biome for linting and formatting
- Strict type checking enabled (`strict: true` in tsconfig)
- Use `const` over `let`, never use `var`
- Maximum line length: 100 characters
- Use explicit return types on functions

**TypeScript/Vue (Frontend):**
- Use ESLint with eslint-plugin-vue + Prettier
- Strict type checking enabled (`strict: true` in tsconfig)
- Prefer Composition API with `<script setup>`
- Use `const` over `let`, never use `var`
- Maximum line length: 100 characters

**C++ (Firmware):**
- Follow ESP-IDF style guide
- Use meaningful names for variables and functions
- Keep functions small and focused
- Comment complex logic
- Use `constexpr` where possible for compile-time constants

### Git Workflow

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring

**Commit format:**
```
<type>: <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat: Add BME680 gas sensor support

Implemented driver for BME680 to measure VOC levels.
Updated data model to include gas resistance readings.

Closes #123
```

## Data Flow Details

### Sensor Reading Lifecycle

1. **ESP32 reads sensors** every 5 minutes
2. **LoRa transmission** to nearest gateway (868MHz)
3. **ChirpStack processes** packet (decrypts, validates, deduplicates)
4. **MQTT publish** to topic: `application/{app_id}/device/{dev_eui}/up`
5. **NestJS ingestion service**:
   - Subscribes to MQTT via microservice transport
   - Decodes the LoRa payload (`@aq/telemetry-codec`) and validates with Zod (`@aq/contracts`)
   - Calculates AQI (Air Quality Index)
   - Writes readings to TigerData (TimescaleDB) via Drizzle (persistence)
   - Publishes to Redis Pub/Sub channel (real-time broadcast)
   - Updates Redis cache (latest values per sensor)
6. **NestJS WebSocket gateway**:
   - Subscribes to Redis Pub/Sub channel
   - Broadcasts new readings to connected clients via Socket.IO
7. **NestJS REST API** serves historical readings from TigerData + metadata from DO Postgres, latest from Redis
8. **Vue.js dashboard** receives real-time updates via WebSocket, fetches history via REST

### Data Format

Sensor readings JSON structure:
```json
{
  "device_id": "sensor_001",
  "timestamp": "2025-10-26T14:30:00Z",
  "location": {
    "latitude": 34.4367,
    "longitude": 35.8498,
    "neighborhood": "Tripoli Downtown"
  },
  "measurements": {
    "pm2_5": 45.3,
    "pm10": 78.2,
    "temperature": 24.5,
    "humidity": 65.0,
    "aqi": 120
  },
  "metadata": {
    "battery_mv": 3750,
    "signal_strength": -57
  }
}
```

## Deployment Phases

**Phase 1 (Months 1-3):** 5-10 sensors, 1 gateway, The Things Network for testing
**Phase 2 (Months 4-6):** 25-50 sensors, 3 gateways, self-hosted ChirpStack, public API
**Phase 3 (Months 7-12):** 100+ sensors, OpenAQ integration, academic partnerships

## Common Issues & Solutions

### LoRaWAN Connectivity
- Check spreading factor (SF7-SF12, higher = longer range but slower)
- Verify frequency band (868MHz for Europe/Middle East)
- Ensure gateway has clear line of sight
- Check antenna connection

### TimescaleDB Performance
- Use continuous aggregates for pre-computed stats
- Set up retention policies to auto-delete old data
- Create hypertables for all time-series tables
- Use BRIN indexes on timestamp columns

### Solar Power Sizing
- Account for 3-5 days of no sun (cloudy/dusty conditions)
- ESP32 deep sleep between readings (crucial for battery life)
- Monitor battery voltage to detect panel issues

## Important Links

**Backend & Frontend:**
- NestJS Docs: https://docs.nestjs.com/
- Vue.js Docs: https://vuejs.org/guide/
- Vite Docs: https://vite.dev/guide/
- Apache ECharts: https://echarts.apache.org/
- Biome Docs: https://biomejs.dev/
- pnpm Docs: https://pnpm.io/
- Turborepo Docs: https://turborepo.dev/docs
- Drizzle ORM Docs: https://orm.drizzle.team/
- Zod Docs: https://zod.dev/

**Infrastructure:**
- ChirpStack Docs: https://www.chirpstack.io/docs/
- TigerData (TimescaleDB) Docs: https://docs.tigerdata.com/
- TimescaleDB Docs: https://docs.timescale.com/
- OpenTofu Docs: https://opentofu.org/docs/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/

**LoRaWAN & Air Quality:**
- The Things Network: https://www.thethingsnetwork.org/
- OpenAQ: https://openaq.org/

**Hardware:**
- LILYGO T-Beam: https://www.lilygo.cc/products/t-beam-v1-1-esp32-lora-module
- PlatformIO ESP-IDF: https://docs.platformio.org/en/latest/frameworks/espidf.html

## Security Considerations

**Never commit:**
- LoRaWAN keys (AppKey, NwkKey, AppSKey, NwkSKey)
- API keys or credentials
- `.env` files with secrets
- Database passwords
- Private keys or certificates

**Always:**
- Use environment variables for secrets
- Validate and sanitize all sensor inputs
- Use parameterized queries (never string concatenation)
- Implement rate limiting on API endpoints
- Use TLS/HTTPS for all network communications

## Code of Conduct

This project follows a common sense code of conduct. Be respectful, collaborative, and focus on the mission: cleaner air for Tripoli.

---

Last updated: June 27, 2026
