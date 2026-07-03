# Architecture & Repository Structure

> Status: **Adopted** · Last updated: 2026-06-27 · Owner: TripoliLabs
>
> This is the canonical reference for how the project is organized and the
> rationale behind the major structural and technology decisions. It supersedes
> the original (≈2025) tech-organized layout. See [Migration Plan](#migration-plan)
> for how we get from the old structure to this one.

---

## 1. System at a glance

The project is **three pillars** plus the cross-cutting infrastructure that
binds them:

| # | Pillar | What it is | Network surface |
|---|--------|-----------|-----------------|
| 1 | **Fullstack app** | Public dashboards + public/REST API | Internet-facing |
| 2 | **Telemetry pipeline** | Ingest → decode → validate → enrich → persist → broadcast | Internal only |
| 3 | **On-prem / edge** | ESP32 firmware + LoRaWAN gateway capture/forward | Field + gateway |

Cross-cutting: shared TypeScript libraries, observability (LGTM), message
brokers, cloud infrastructure (DigitalOcean via OpenTofu), CI/CD, and on-prem
deployment workflows.

### Data flow

```
ESP32 (firmware) ──LoRa──> Gateway (ChirpStack) ──MQTT──> EMQX broker
                                                              │
                                          ┌───────────────────┘
                                          ▼
                              services/ingestion  (Pillar 2)
                                  decode → validate (Zod) → AQI → sink
                                          │
                         ┌────────────────┼─────────────────┐
                         ▼                ▼                  ▼
                  TigerData          Redis Pub/Sub       Redis cache
                  (TimescaleDB:      (realtime fan-out)  (latest value)
                   readings)               │
                         ▲                  ▼
                         │          apps/api  WebSocket gateway
                         │                  │
   DO Managed Postgres ──┤   apps/api REST ─┴──────► apps/dashboard (Vue)
   (relational app data) ─┘   (reads both DBs; joins metadata in app layer)
```

The **design principle** that differs most from the original layout: organize by
**domain and deployable boundary**, not by technology. The old structure had
`backend/`, `frontend/`, `firmware/`, `monitoring/`, `mqtt/`, `gateway/` flat at
the root with no shared code. This one draws clean lines between *what ships
where* and pulls all reusable logic into shared packages.

---

## 2. Repository layout

A single **monorepo** managed with **pnpm workspaces + Turborepo**.

```
air-quality-monitoring/
├─ apps/                     # Pillar 1 — public-facing, deployable
│  ├─ dashboard/             #   Vue 3 + Vite SPA (the existing, working frontend)
│  └─ api/                   #   NestJS: public REST + WebSocket (read/serve)
│
├─ services/                 # Pillar 2 — telemetry pipeline (internal, no public surface)
│  └─ ingestion/             #   MQTT consume → decode → validate → AQI → sink + publish
│                            #   Built as a MODULAR MONOLITH; split only when forced.
│
├─ firmware/                 # Pillar 3a — ESP32 (PlatformIO + ESP-IDF), isolated toolchain
│  ├─ src/{sensors,lora,power}/
│  └─ platformio.ini
│
├─ edge/                     # Pillar 3b — on-prem gateway
│  ├─ chirpstack/            #   ChirpStack v4 config (moved from gateway/)
│  └─ agent/                 #   optional store-and-forward buffer for outages (TBD)
│
├─ packages/                 # Shared TypeScript libraries — the core upgrade
│  ├─ domain/                #   Pure logic: AQI calc, unit conversions, thresholds, core types
│  ├─ contracts/             #   Zod schemas: REST DTOs + event/MQTT/WS payloads (single source of truth)
│  ├─ db/                    #   Drizzle schema + migrations + typed clients for BOTH databases
│                            #     (DO relational + TigerData telemetry)
│  ├─ telemetry-codec/       #   LoRa payload spec + TS decoder, mirrors the firmware C struct
│  ├─ observability/         #   OpenTelemetry init, structured logger, metric helpers
│  └─ config/                #   Shared tsconfig / biome / eslint presets + env schema (Zod)
│
├─ infra/                    # OpenTofu — DigitalOcean provisioning
│  ├─ modules/               #   reusable: droplet, managed-pg, spaces, vpc, dns, firewall
│  └─ environments/
│     ├─ staging/
│     └─ production/
│
├─ deploy/                   # Runtime composition (the "how it runs")
│  ├─ compose/               #   local full-stack docker-compose (moved from root)
│  ├─ observability/         #   LGTM stack: grafana, loki, tempo, mimir, alloy + dashboards-as-code
│  └─ onprem/                #   ansible / cloud-init for gateway boxes
│
├─ .github/workflows/        # CI/CD — affected-graph aware
├─ docs/                     # architecture (this file), ADRs, runbooks
├─ turbo.json                # task graph + caching
├─ pnpm-workspace.yaml       # workspace globs + catalogs (pinned shared versions)
└─ package.json              # pnpm workspaces root ("packageManager": "pnpm@11.x")
```

### Why `apps/` vs `services/`

`apps/` is **public-facing and deployed to the internet edge**; `services/` is
**internal pipeline with no public HTTP surface**. They have opposite profiles —
the API is read-heavy and internet-exposed; ingestion is write-heavy, consumes
MQTT, and never accepts public traffic. Separating them lets each scale, deploy,
and be secured independently. This is the single most important structural change
from the original undifferentiated `backend/`.

### Anti-pattern guardrails

- **No premature microservices.** `services/ingestion` and `apps/api` are each a
  **modular monolith** — clean internal module boundaries, one deployable per
  process. The folder structure permits splitting later without a rewrite. At
  Phase 1–2 scale (dozens of sensors) more processes = pure overhead.
- **No logic duplication across pillars.** Anything used by more than one app/
  service lives in `packages/`. AQI calculation, in particular, must exist in
  exactly one place (`packages/domain`) — today it is duplicated in the
  frontend's `useAqi.ts` and would otherwise be reimplemented in the backend.

---

## 3. Shared packages (the backbone)

These are built first; everything else depends on them.

| Package | Owns | Depended on by |
|---------|------|----------------|
| `@aq/config` | tsconfig/biome/eslint presets, runtime env schema (Zod) | everything |
| `@aq/domain` | AQI math, unit conversions, thresholds, framework-free core types | dashboard, api, ingestion |
| `@aq/contracts` | Zod schemas for REST DTOs **and** MQTT/WS event payloads | dashboard, api, ingestion |
| `@aq/db` | Drizzle schema + migrations + typed clients for **both** DBs (DO relational + TigerData telemetry) | api, ingestion |
| `@aq/telemetry-codec` | LoRa byte-layout spec + TS decoder (mirrors firmware struct) | ingestion (+ firmware via codegen) |
| `@aq/observability` | OTel SDK init, logger, metric/trace helpers | api, ingestion |

> **`@aq/` is a placeholder scope** — final npm scope (e.g. `@tripolilabs/`) to be
> confirmed when the workspace is scaffolded.

### The firmware ↔ cloud payload contract

The byte layout the ESP32 packs **must** exactly match what `services/ingestion`
decodes. Define it **once** in `packages/telemetry-codec` as a spec and generate
both sides (TS decoder + C struct) so a firmware payload change cannot silently
break ingestion. This is the most commonly skipped best practice in LoRa systems
and the original repo had no contract at all between the two sides.

---

## 4. Technology decisions

Stack inherited from the original design (Node 24, TypeScript 5.9, NestJS 11,
Vue 3.5, Redis, MapLibre, ECharts, ChirpStack, Lefthook) is retained. The
data store, data-access layer, package manager/runtime, and linting were
re-researched against the **June 2026** state of the ecosystem and are recorded
below as ADRs. Each ADR's claims were verified against primary sources in
June 2026; key source URLs live in the research notes, not inline here.

### ADR-001 — Database topology & access: **two managed DBs + Drizzle**

**Topology.** Two **managed** databases, split by data shape:

- **Relational app data** (users, auth, API keys, sensor/device metadata,
  locations, dashboard config) **+ ChirpStack state** → **DigitalOcean Managed
  PostgreSQL**.
- **Time-series telemetry** (the `readings` hypertable, continuous aggregates,
  columnar compression, retention) → **TigerData / Tiger Cloud** (managed
  TimescaleDB, full TSL edition; vendor formerly "Timescale Cloud").

There are **no native cross-DB joins** — readings are enriched with sensor/
location metadata in the **app layer** (metadata is small and cached in Redis).

**Why two, and why not co-locate on DO.** This was the decisive finding:
**DigitalOcean Managed Postgres ships TimescaleDB's Apache-2.0 edition only.**
Compression, continuous aggregates, and retention policies — all three required
by this project — return `functionality not supported under the current 'apache'
license`. This is structural: the Timescale License §2.2 forbids third parties
from offering the TSL community features as a managed service (the same reason
Aiven and Azure are Apache-only, and AWS RDS doesn't offer the extension at
all). So the readings hypertable **cannot** live on DO Managed Postgres. Only
self-operating TimescaleDB or using **TigerData** unlocks those features —
TigerData provides them fully managed. The relational data is genuinely happy on
DO Managed Postgres (managed HA + backups), and keeping the two separate also
isolates ingestion write-load from app reads. Cost ≈ **$45–65/mo** total at
Phase 1–2 scale, for zero database-ops.

**Access layer.** One unified tool — **Drizzle ORM** (`drizzle-orm@0.45.2`,
**stable line, not the 1.0 RC**) — for **both** databases, exposed as **two
typed clients** (one per DB) from a single `packages/db`:

- `drizzle-kit generate` for ordinary relational DDL; **`drizzle-kit generate
  --custom`** raw-SQL migrations for all Timescale DDL (`create_hypertable`,
  `CREATE MATERIALIZED VIEW … WITH (timescaledb.continuous)`,
  `add_compression_policy`, `add_retention_policy`).
- Driver: **postgres.js** (`postgres@3.4.x`). NestJS `DatabaseModule` exposes
  both `PostgresJsDatabase<typeof schema>` clients under injection tokens.
- **Ownership:** `services/ingestion` (the writer) owns the **telemetry**
  schema/migrations; `apps/api` owns the **relational** schema and consumes
  telemetry types read-only.

**Why Drizzle (direct answer to "does the relational side need TypeORM?" — No).**
One tool spanning both shapes beats mixing two query libraries. Drizzle has the
best Node/Bun story of any candidate, gives schema-in-TS + a relational query API
for the app data, and its `--custom` SQL migrations make Timescale's
ORM-invisible features a non-issue (model the table with a composite PK incl.
`time`, then create the hypertable in raw SQL).

**Rejected alternatives.**
- **TypeORM 1.0** (revived May 2026): weaker compile-time inference, heavier
  decorator/metadata machinery, and its only Timescale edge —
  `@timescaledb/typeorm` — is **v0.0.1, untouched since April 2025** (abandoned-
  experimental). Don't bolt production telemetry to that.
- **Prisma 7** (Rust-free client): weakest Timescale fit (hypertable PK gymnastics,
  continuous aggregates fall outside the model) and documented Bun/ESM friction.
- **Kysely** (ergonomically the best Timescale query fit): brings no schema DSL
  or migration system, so it would force a *second* tool — reintroducing the
  two-tool split this decision avoids. Drizzle gives schema + migrations + queries
  in one.

**Revisit.** If cross-DB joins become painful, consider consolidating onto a
self-hosted TimescaleDB on a DO Droplet (full TSL, native joins, but you own
DB-ops). If telemetry write-load grows, add PgBouncer + a read replica on the
TigerData side. Upgrade Drizzle to 1.0 once it ships **GA**.

### ADR-002 — API & event contracts: **Zod 4 shared package + nestjs-zod**

**Decision.** A single shared package `packages/contracts` holds **Zod 4**
(`zod@4.4.x`) schemas as the source of truth for **all four boundaries**: REST
DTOs, MQTT ingestion payloads, WebSocket/Redis events, and the frontend.

- **API (`apps/api`):** `nestjs-zod@5.4.x` turns those schemas into NestJS DTOs
  (validation + types + auto-generated OpenAPI via `cleanupOpenApiDoc`). Idiomatic
  NestJS controllers/pipes/guards — no competing abstraction.
- **Ingestion (`services/ingestion`):** the same event schemas validate decoded
  MQTT uplinks before persistence and before publishing to Redis.
- **Frontend (`apps/dashboard`):** imports `@aq/contracts` **directly** → gets
  both types *and* runtime validation of API responses / WS messages, with zero
  codegen and zero drift. (Use `@zod/mini` at the Vue entrypoint if bundle size
  becomes a concern.)
- **External consumers only:** generate clients from the published OpenAPI doc
  with `openapi-typescript@7.x` + `openapi-fetch`. Never used for our own
  in-monorepo apps.

**Why.** One Zod definition guards HTTP, the event bus, the socket, and the UI —
giving end-to-end type safety **and** runtime validation. `nestjs-zod` keeps the
API idiomatic and emits the OpenAPI spec external consumers need. Importing the
package directly in the dashboard removes the drift window that OpenAPI-first
codegen introduces. This also aligns with NestJS v12's direction (native
Standard Schema support for Zod in `@Body`/`@Query`/`@Param`).

**Rejected alternatives.** **ts-rest** and **tRPC** are REST-only / RPC-only —
neither covers the MQTT or event-schema side, and both are redundant with
`nestjs-zod` here while adding a competing contract abstraction. **OpenAPI-first
codegen for internal apps** produces types only (no runtime validation) and a
drift window; reserved strictly for external SDKs.

### ADR-003 — Package manager & runtime: **pnpm to install, Node to run**

**Decision.** Use **pnpm 11.x** as the workspace/package manager, and run the
NestJS services on **Node.js LTS** — *not* the Bun runtime. **Bun** stays
available as an optional fast test/script runner (`bun test` on `packages/*`).
This **supersedes the original Bun-everywhere choice** in CLAUDE.md.

> "package manager" and "runtime" are independent decisions. pnpm can't be the
> runtime anyway; Bun could be, but shouldn't here.

**Why pnpm to install.** Mature strict, non-flat `node_modules` (phantom-
dependency protection) ideal for shared `packages/*`; best-in-class Docker layer
caching via `pnpm fetch`; first-class `turbo prune --docker`; catalogs to pin
shared dep versions across all workspaces. Set `"packageManager": "pnpm@11.x"`
(Turborepo requires it); requires Node 22+.

**Why Node to run.** Our exact stack hits the Bun runtime's 2026 soft spots:
mqtt.js-over-TLS (the EMQX path), ioredis, TypeORM/Drizzle-under-SWC quirks, and
long-uptime memory behavior in a 24/7 ingestion service. The Bun runtime's
speed edge is irrelevant when the bottleneck is Postgres/Redis/MQTT I/O. NestJS
also has no official Bun support. (Context: Anthropic acquired Bun's company in
Dec 2025 — well-funded, but its roadmap follows agent-tooling, not long-running
backends.)

**Revisit Bun-as-runtime** only when NestJS documents official Bun support, the
mqtt-TLS/ioredis issues are verified fixed, and a 72h memory soak of the
ingestion service passes.

### ADR-004 — Linting & formatting: **split — Biome (backend) / ESLint+Prettier (frontend)**

**Decision.** Keep a deliberate split:

- **Backend** (`apps/api`, `services/ingestion`, `packages/*`) → **Biome 2.5**
  (single binary, type-aware linting without `tsc`, its own formatter — no
  Prettier). Formats NestJS decorators fine.
- **Frontend** (`apps/dashboard`, Vue 3 SFC + Tailwind) → **ESLint 9 +
  eslint-plugin-vue 10.9 + typescript-eslint 8 + Prettier 3.9** with
  `prettier-plugin-tailwindcss` for class sorting.

**Why the split (not unified).** It's the correct, mainstream 2026 setup, not a
compromise: **only `eslint-plugin-vue` does real `<script setup>`↔`<template>`
cross-analysis** (catching a var used in the template but undeclared in script,
component-naming, unused props). Biome and oxlint still **don't parse Vue
templates** in 2026 — Biome's Vue work is CSS-class usage, oxlint lints only the
`<script>` block. So Vue *requires* ESLint, while pure-TS backend code is faster
and Prettier-free on Biome.

**Watching:** **oxlint/oxc** (VoidZero) has the strongest trajectory but its
formatter `oxfmt` is still beta — re-evaluate replacing Biome on the backend
when oxfmt hits stable 1.0. The frontend stays on ESLint regardless.

### Tooling

- **Monorepo orchestration:** pnpm workspaces + **Turborepo** (task graph +
  caching), with pnpm **catalogs** pinning shared dependency versions.
- **CI runs on the affected graph** (Turbo) so a firmware-only change doesn't
  rebuild the dashboard, and vice versa — replaces the current
  `dorny/paths-filter` approach with dependency-DAG awareness.
- **Git hooks:** Lefthook, with path-scoped `backend-lint` (Biome) and
  `frontend-lint`/`frontend-format` (ESLint/Prettier) jobs.

---

## 5. Cross-cutting concerns

### Infrastructure — `infra/` (OpenTofu, DigitalOcean)

- Reusable `modules/` (droplet/app-platform, DO Managed Postgres, Spaces, VPC,
  DNS, firewall) composed per environment under `environments/{staging,production}/`.
- **State** in DigitalOcean Spaces (S3-compatible backend) with locking.
- **TigerData lives outside the DO plane.** The telemetry DB is provisioned on
  TigerData (its own console / Terraform provider), so it's a second managed
  vendor — reference its connection string as a secret in `infra/`, but don't
  expect it under the DO provider.
- **Provisioning (`infra/`) is separate from deployment (`deploy/`)** — OpenTofu
  stands up the boxes/managed services; app rollout is its own pipeline.

### Observability — `deploy/observability/` + `packages/observability`

- **Configs as code** for the LGTM stack: **L**oki (logs), **G**rafana
  (dashboards, provisioned as JSON/code), **T**empo (traces), **M**imir
  (metrics), with **Alloy** as the collector. Prometheus scrape configs move here.
- **Instrumentation as a package**: `packages/observability` centralizes the
  OpenTelemetry SDK init, structured logging, and metric/trace helpers so every
  TS service emits consistent telemetry. The API must expose `/metrics` (the
  existing `prometheus.yml` already targets it).

### Brokers

- **MQTT:** **Mosquitto** (self-hosted, dev + prod; in the root `docker-compose.yml`),
  **EMQX** (serverless/managed) in production — identical MQTT contract, so app
  code is unaffected. **Redis** for pub/sub fan-out + latest-value cache.
- Local dev brokers run from the root compose; cloud uses managed/hosted
  equivalents referenced via `infra/`.

### CI/CD — `.github/workflows/`

- Per-target pipelines selected by the Turbo affected graph.
- **Firmware is fully isolated**: its own workflow, excluded from the Turbo graph,
  interacting with the rest only through `packages/telemetry-codec`.
- Bundle-size budgets and lint/typecheck/test gates per package.

### On-prem deployment — `deploy/onprem/`

- Ansible / cloud-init for gateway boxes (ChirpStack host + optional
  store-and-forward agent), designed for Lebanon's intermittent connectivity
  (offline buffering, reconnect/backoff).

---

## 6. Firmware in-repo vs. separate (decision)

**Kept in the monorepo, fully isolated.** Co-locating firmware gives atomic
commits when the LoRa payload format changes on both the firmware and ingestion
sides. The cost — a foreign C++/PlatformIO toolchain inside a pnpm/Turbo
workspace — is contained by excluding it from the Turbo graph and giving it a dedicated CI
workflow. It communicates with the cloud side only through the payload contract
in `packages/telemetry-codec`. **Revisit** only if firmware cadence/contributors
diverge sharply from the cloud side.

---

## 7. Migration plan

> **Status (2026-06-27): executed.** The monorepo skeleton is in place — frontend
> moved to `apps/dashboard`; `apps/api`, `services/ingestion`, and all `packages/*`
> scaffolded fresh and building; `gateway/`→`edge/chirpstack`, `monitoring/`→
> `deploy/observability`; `infra/` + `deploy/onprem` stubbed; old `backend/` code
> scrapped. Remaining: real schema + migrations (`@aq/db`), then feature work.

Incremental, not big-bang. The one working limb (the Vue frontend) stays alive
throughout; valuable existing config is **moved into new homes, not deleted**.

1. **Workspace skeleton + backbone packages.** Stand up pnpm workspaces + Turbo
   (`"packageManager": "pnpm@11.x"`, `pnpm-workspace.yaml` with catalogs), then
   `packages/config`, `packages/domain`, `packages/contracts`. Everything leans
   on these.
2. **Move the frontend** → `apps/dashboard/`, repoint it at `@aq/domain`
   (eliminates the `useAqi` duplication) and `@aq/contracts`. Keeps working.
3. **Build `packages/db`** — two Drizzle clients/schemas: relational (DO Managed
   PG) and telemetry (TigerData), with `--custom` SQL migrations for hypertables,
   continuous aggregates, compression + retention. Replaces the 3-line
   `01-extensions.sql` scaffold.
4. **Build `services/ingestion`** against `@aq/db`, `@aq/contracts`,
   `@aq/telemetry-codec` (replaces the stubbed `mqtt.service.ts`); it owns the
   telemetry migrations.
5. **Carve out `apps/api`** as the read side (replaces the stubbed
   `sensors.controller.ts`); reuse the existing entities/DTOs as the basis for
   contracts and schema.
6. **Relocate infra/runtime config:** `gateway/` → `edge/chirpstack/`, root
   `docker-compose.yml` stays at root for local dev (a thinned cloud composition
   may live under `deploy/`), `monitoring/` → `deploy/observability/`, stand up
   `infra/` (OpenTofu) and `deploy/onprem/`.
7. **Rewire CI/CD** to the Turbo affected graph; isolate the firmware workflow.

### What carries over from the old structure (move, don't delete)

- Root `docker-compose.yml` (now NanoMQ + two-DB), `gateway/chirpstack.toml`,
  `mqtt/nanomq.conf`, `monitoring/prometheus.yml` — correct configs, relocate
  as noted.
- Backend `entities/` + `dto/` — the basis for `@aq/db` schema and `@aq/contracts`.
- Firmware `.h` driver headers — well-designed API contracts, keep.
- `hardware/`, `docs/` — reference material, keep.

The stubbed application bodies (`mqtt.service.ts`, `sensors.controller.ts`,
firmware `.cpp` bodies, `database/init`) are the only genuinely
fill-in / rewrite targets.

---

## 8. Decision log

| ID | Decision | Status |
|----|----------|--------|
| ADR-001 | Two managed DBs (DO Postgres relational + TigerData telemetry); Drizzle for both | Adopted |
| ADR-002 | Zod 4 shared package + nestjs-zod for contracts | Adopted |
| ADR-003 | pnpm to install + Node LTS runtime (Bun optional for tests) | Adopted |
| ADR-004 | Lint split: Biome (backend) / ESLint+Prettier+eslint-plugin-vue (frontend) | Adopted |
| — | pnpm + Turborepo monorepo, domain/deployable layout | Adopted |
| — | Mosquitto broker, self-hosted dev + prod | Adopted |
| — | Firmware kept in-repo, isolated, contract via telemetry-codec | Adopted |
| — | Modular monolith per service; no premature microservices | Adopted |

### Open questions (to resolve during scaffolding)

- Final npm scope (`@aq/` placeholder → `@tripolilabs/`?).
- Whether `edge/agent` (store-and-forward) is needed for Phase 1 or deferred.
- TigerData exact plan/region + whether the relational DB needs managed HA
  (standby) at Phase 1, or single-node is fine.
- **CLAUDE.md still documents Bun + EMQX-only + "TimescaleDB on Postgres 16";**
  update it to match ADR-001/003 (pnpm+Node, NanoMQ local, two managed DBs) when
  convenient.
```
