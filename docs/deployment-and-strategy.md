# Deployment & Strategy Decisions

> **Purpose:** Strategic decisions from a planning session on **2026-07-01**, written
> as a handoff so a fresh Claude Code session (or contributor) can start implementing
> without re-deriving the reasoning. This is a *decisions + next-steps* document, not
> a spec. Canonical architecture still lives in [`architecture.md`](architecture.md);
> promote anything here to a formal ADR once implemented.

## TL;DR — what we decided

1. **Host on Hetzner Cloud** (self-hosted VMs), not DigitalOcean managed services. ~5–10× cheaper for this workload.
2. **Self-host the full stack on the VM** — including TimescaleDB (full TSL). **TigerData is retired:** telemetry lives on self-hosted Timescale on the box (Postgres + extension), no separate managed-DB bill.
3. **MQTT broker: self-hosted, server-side, on the VM.** Not managed EMQX Cloud. It's internal glue for ChirpStack, not a public service.
4. **Broker software: Mosquitto**, used in **both local dev and prod** (drop the current NanoMQ-local / EMQX-prod split for dev/prod parity).
5. **No on-prem broker / no on-prem ChirpStack for now.** Whole pipeline runs cloud-side. Revisit only if measured backhaul-outage data loss proves material.
6. **Observability: Grafana Alloy → Grafana Cloud (free tier).** The right call, and **implemented** — services push OTLP to Alloy, which forwards to Grafana Cloud (`deploy/observability/alloy/config.cloud.alloy`; secrets tracked in issue #43). Do *not* run the LGTM stack in prod; keep the local `observability` compose profile for dev.
7. **Firmware config changes: via LoRaWAN downlinks.** Design a downlink command schema so most remote changes never need a reflash.
8. **OTA: deferred.** USB reflash is fine for Phase 1. But set up OTA-capable partitions now so we're not stuck later.
9. **Payload evolution:** use the reserved **byte 12** as a version/sensor-bitmask, and move toward **single-source codec generation** (C + TS from one spec) before the sensor set grows.
10. **Staging = a second Hetzner box**, identical stack, with the **`simulator` container** as its data source. Prod is the same box shape but fed by **real hardware** (ESP32 + LoRaWAN gateway); nothing else differs → true prod parity.
11. **Backups are non-negotiable and off-box.** Automated DB backups (pgBackRest/WAL-G → object storage or a Hetzner Storage Box) from day one. The readings dataset *is* the product — a dead box must not lose it. This matters more than the LoRaWAN-outage gap in §3.
12. **Secrets reach the box via GitHub Environment secrets, injected by the deploy workflow** — zero secret material in git (public repo) or in Terraform state; SOPS+age is the documented fallback. See §6.

Funding note: apply for **DO Open Source credits** (OSI license ✓, but small — tiered by GitHub stars, starts ~$60/yr) and, if TripoliLabs registers as a nonprofit, **DO for Nonprofits ($2,500 one-time)** + **Azure/AWS nonprofit** credits (recurring, larger). Treat credits as bonus runway, not the baseline — Hetzner is the sustainable steady state.

---

## 1. Hosting: Hetzner over DigitalOcean

**Decision:** Deploy on Hetzner Cloud VMs, EU region (Falkenstein `fsn1` or Helsinki `hel1`) for lowest latency to Tripoli.

**Why:**
- Cost. Realistic monthly cost:
  - **DO managed path:** ~$85–200/mo (managed Postgres + managed Valkey + a droplet + **TigerData still required on top**, since DO Managed Postgres can't run Timescale TSL — see ADR-001).
  - **Hetzner self-hosted:** ~$10–25/mo. Self-hosting TimescaleDB on the VM removes the TigerData bill entirely (it's just Postgres + the extension on a box you control). This is the single biggest saving and it collapses the two-DB *hosting* split — see note below.
- The stack is already Compose-native, so self-hosting is low friction.
- 4G-backhaul resilience thesis favors owning the boxes.

**Suggested sizing (small scale, 6 → ~100 nodes; throughput is trivial — 1 small msg/node/5 min):**
- Single box to start: **CX42** (8 vCPU / 16 GB / 160 GB) ~$15/mo, runs everything.
- Add a block-storage volume for DB data + backups (~$5/mo).
- Split into app-box + DB-box later if needed (2× CX32).

**Availability caveat:** Hetzner has a smaller footprint than DO and popular locations occasionally run out of stock for specific server types (esp. the dedicated CCX line). The shared **CX** line we'd use is almost always available; provision early anyway.

**Tooling:** `hcloud` CLI (official). `hcloud context create <name>` (API token) → `hcloud server ssh <name>` for shell. First-class Terraform/OpenTofu provider — wire into `infra/`.

**Two-DB note:** ADR-001's two-database split was driven by *DO's inability to run Timescale TSL*. On Hetzner we self-host both, so the split is now a **choice** (isolate ingestion write-load from app reads), not a forced constraint. **TigerData is retired.** **Recommendation for Phase 1: co-locate** — one Postgres instance for app data + one for telemetry-with-Timescale on the *same box* (or even a single instance), so there's one thing to back up, patch, and watch. Split onto separate boxes only when measured load demands it.

**Honest trade — you become the DBA/SRE.** Self-hosting saves the managed bill but transfers backups, patching, upgrades, HA, and disk-full watch to us. That's an acceptable Phase-1 trade *only with §6's backups + alerts in place*. For a volunteer-run project, "managed" buys resilience we may not have the hours to replicate; revisit if ops load bites.

**Staging vs prod:** **Staging is a second Hetzner box** running the identical `docker-compose.yml`, with the **`simulator` container** as its data source (it provisions ChirpStack + streams simulated LoRaWAN uplinks, exactly as locally). **Prod is the same box shape** but the `simulator` is omitted and fed by **real hardware** (ESP32 nodes → DLOS8N gateway → the box's gateway-bridge). Same infra, same config — only the data source differs → real prod parity. (The simulator's re-provisioning is now idempotent against a long-lived ChirpStack, so a staging restart is safe.)

**Implementation pointers:**
- `infra/` — one reusable OpenTofu module for Hetzner (CX42 + block volume + firewall + cloud-init that pulls up `docker-compose.yml`), instantiated twice: `staging` (with the simulator) and `prod` (without).
- Telemetry DB stays on the box (self-hosted full-TSL Timescale) — no managed telemetry DB.

---

## 2. MQTT broker: self-hosted Mosquitto, server-side

**Decision:** Run **Mosquitto** on the VM, on the private network next to ChirpStack + ingestion. Use it in **both local and prod**. Retire the NanoMQ-local / EMQX-prod split.

**Why self-hosted (not managed EMQX Cloud):**
- The broker is *internal glue*: `gateway-bridge → [MQTT] → ChirpStack → [MQTT] → ingestion`. All those services are co-located, so the broker is effectively localhost IPC. A managed cloud broker adds latency, egress, cost, an external dependency, and an availability coupling (ChirpStack stalls if the managed broker/link blips) — for zero benefit at our throughput.

**Why Mosquitto (not NanoMQ):**
- At our scale the deciding factor is **stability + operational simplicity + docs**, not throughput. Mosquitto is the battle-tested reference broker, tiny footprint, ChirpStack-canonical (their docs use it), and supports everything we need (MQTT 5, TLS, shared subscriptions since 2.0 — the latter only matters if we scale to multiple ingestion instances).
- NanoMQ's advantages (multi-core throughput, MQTT-over-QUIC, EMQ bridging, edge optimization) don't apply to a server-side broker carrying trivial traffic.
- Using the same broker everywhere kills "works locally, breaks in prod" risk.

**When NanoMQ would win instead:** only if we later push the broker **on-prem onto the gateway box** for offline store-and-forward over a flaky 4G link (edge/bridge scenario). See §3.

**Implementation pointers:**
- Swap the `mqtt/` config and the compose broker service to Mosquitto (matching local + prod config, TLS-ready listener, no public port — private network only).
- Update the relevant ADR note in `architecture.md` (currently EMQX prod / NanoMQ local).

---

## 3. On-prem: not now

**Decision:** No on-prem broker and no on-prem ChirpStack for now. The whole pipeline runs cloud-side on the Hetzner VM. The gateway only runs the Semtech UDP packet-forwarder / Basic Station and ships to the server-side gateway-bridge.

**Why this is even a question:** neither the Semtech UDP packet-forwarder (fire-and-forget UDP) nor Basic Station buffers uplinks during a backhaul outage — any reading that arrives while the 4G link is down is **lost permanently**. The *only* way to close that gap is to run ChirpStack (+ broker + a local buffer) on-prem at the gateway site and sync to cloud when the link returns.

**Why we're deferring it:**
- On-prem = a second full deployment on a mini-PC/SBC in the field: extra hardware cost, another thing to power (solar), update, monitor, and physically secure against theft.
- 4G backhaul is already the resilience play; short blips lose only a few 5-min points — statistically minor for pollution *trends*.
- We're in Phase 1 (5–10 sensors, testing). This is a Phase 2/3 hardening decision.

**Revisit trigger:** ship cloud-only, **measure actual outage-driven data loss**, and only invest in on-prem if it proves material to the dataset's value. If we do, that's the scenario where **NanoMQ** (edge caching + bridging) beats Mosquitto.

---

## 4. Observability: Alloy → Grafana Cloud (free tier)

**Decision:** In prod, run **Grafana Alloy** on the VM shipping metrics/logs/traces to **Grafana Cloud (free tier)**. Do **not** run the LGTM stack in prod. Keep the local `docker compose --profile observability` LGTM stack for **dev only**.

**Why:**
- The LGTM stack (Loki + Mimir + Tempo + Grafana + Prometheus) is heavier than our entire app — it would dominate the CX42 and force us to size up just to watch ourselves.
- **Off-box telemetry survives incidents:** if the VM OOMs/crashes/fills disk, self-hosted observability dies with the thing we need to debug. Grafana Cloud keeps our signals when the box is down — a real resilience argument.
- Zero ops burden (no retention tuning, scaling, backups).
- Free tier (≈10k metric series, 50 GB logs, 50 GB traces, 14-day retention) fits our scale comfortably.
- We already emit OpenTelemetry via `@aq/observability`; Alloy ingests OTLP natively and forwards it. Alloy itself is lightweight.

**Revisit trigger:** data-sovereignty requirements (not a concern for air-quality metrics/logs), or exceeding the free tier at Phase 3 — at which point give observability its *own* box, don't cram LGTM onto the app VM.

**Status: implemented.** Services emit OTLP; Alloy is the collector (`deploy/observability/alloy/config.alloy` local, `config.cloud.alloy` for Grafana Cloud — same three pipelines, only the exporters differ). Local LGTM lives behind `--profile observability`. The `GRAFANA_CLOUD_*` secrets are tracked in **issue #43**. Remaining: mount `config.cloud.alloy` + pass the env in the prod/staging deployment (part of `infra/`).

**Free-tier caveats to manage (learned while building it):**
- **Metric cardinality vs the ~10k-series cap.** The `http_server_duration` histogram is `route × method × status × le-bucket × service` — that multiplies fast. Watch it; drop high-cardinality labels or the histogram if it balloons.
- **Log volume vs the 50 GB/mo cap.** Alloy currently tails **every** container (incl. chatty ChirpStack/simulator). Before pointing at Cloud, filter to the app services' logs and/or raise log levels.

**Add alerting — it's the point.** For unattended field nodes, define a few Grafana Cloud alerts: *no readings for N minutes*, *ingestion stalled*, *disk > 80%*, *node battery low*, *TLS cert expiring*. Signals with no alerts don't protect anything.

**Implementation pointers:**
- Add the Alloy service/config to the prod/staging compose (already in the local compose behind the profile); creds via env, never committed.
- Leave `deploy/observability/` LGTM configs as the dev-only path.

---

## 5. Firmware: adding sensors, config, and deployment

Context from reading the firmware (ports & adapters; portable `core/` + esp32/sim adapters; a **fixed 13-byte little-endian payload** as the single source of truth, hand-mirrored between C and TS).

### 5a. Adding a sensor is a coordinated schema change (not plug-and-play)

Every new measurement touches this chain (example: CO₂):

| # | File | Change |
|---|------|--------|
| 1 | `firmware/core/aq_reading.h` | add field to `aq_reading_t` |
| 2 | `firmware/core/aq_sensors.h` | add HAL fn (or extend existing) |
| 3 | `firmware/adapters/esp32/sensors_esp32.c` | real driver |
| 4 | `firmware/sim/sensors_sim.c` | simulated driver (keeps host tests + simulator working) |
| 5 | `firmware/core/aq_payload.{h,c}` | bump `AQ_PAYLOAD_LEN`, extend encoder |
| 6 | `packages/telemetry-codec/src/index.ts` | **mirror the exact bytes** in decoder/encoder + `DecodedPayload` |
| 7 | `firmware/test/test_payload.c` + `packages/telemetry-codec/test/codec.test.ts` | update both |
| 8 | `packages/contracts/src/sensor.ts` (Zod), `packages/db/src/telemetry/schema.ts` (+ migration), domain/AQI, API DTO, dashboard | persist + expose |

**Main friction:** the C encoder (`aq_payload.c`) and TS decoder (`index.ts`) are kept byte-identical *by hand*. Drift risk is real.

### 5b. Payload evolution (do this before the sensor set grows)

- **Byte 12 is `reserved/flags`, currently always `0`.** Repurpose it as a **payload-version byte and/or sensor-presence bitmask**. This unlocks:
  - graceful mixed-firmware rollouts (decoder branches on version),
  - **heterogeneous fleets** (not every node carries every sensor) — the current fixed layout can't express this without zero-padding.
- **Move to single-source codec generation:** generate both the C and TS codecs from one spec (byte layout defined once), so a new sensor is *one* edit instead of two-kept-in-sync. This is the highest-leverage structural fix for the "possibilities are endless" goal.

### 5c. Feasibility limits are physics, not code

Adding scalar sensors (CO₂ SCD41, VOC/gas SGP40 or BME680, NO₂/O₃ electrochemical→ADC, noise, UV/light) is easy code-wise. The real ceilings:
- **LoRaWAN airtime / EU868 ~1% duty cycle** — bigger payloads → longer airtime → longer mandatory silence; payload max shrinks at higher SF (~51 B at SF12 up to ~222 B at SF7). At 13 B / 5 min we have lots of headroom, but it's a budget.
- **Power** — each sensor costs energy/sample; PMS7003 fan + NDIR CO₂ are heavy draws on a solar/18650 node. This is usually the true limit.
- **Range** — larger payloads may force lower SF (shorter range).

So: a handful of extra measurements per node is practical; an open-ended per-node sensor zoo is not. Design payloads around the airtime/power budget.

### 5d. Config changes via LoRaWAN downlinks (build this)

You **cannot** push firmware over LoRa practically, but you **can** push small **downlink commands**. Design a downlink command schema so remote changes don't need a reflash:
- sample interval, calibration offsets, alert thresholds, enable/disable a behavior.
- This is the pragmatic "change stuff remotely" answer and decouples config from firmware.
- **Timing caveat:** Class A nodes only open an RX window *right after an uplink*, so a queued downlink lands up to one sample-interval later (and is gateway-duty-cycle limited). Fine for occasional config; don't expect instant.

### 5e. OTA: deferred, but prepare the ground now

**Current state:** no OTA. Deployment = physical USB flash (`pio run -t upload`). Also `platformio.ini` references `board_build.partitions = partitions.csv` **but that file doesn't exist** (verified) — so this **breaks `pio run` today**. Creating it isn't just future-proofing; it's a current fix. OTA also requires a dual-app partition layout anyway.

**Why OTA is hard here:**
- **FUOTA** (LoRaWAN fragmented multicast update) is complex, very slow (duty-cycle throttled), power-hungry, impractical for full ESP32 images. Skip unless it becomes a hard requirement.
- **ESP32 native OTA** (`esp_https_ota`) needs IP connectivity — field nodes have none by design.

**Key insight:** adding a *new physical sensor* needs a site visit anyway (to wire it), so reflashing on-site then costs nothing extra. OTA's real value is **remote bug/logic fixes** to already-deployed nodes.

**Plan:**
1. Phase 1 (≤10 nodes): USB reflash is fine. Stabilize firmware.
2. **Build the downlink config channel** (§5d) — highest leverage.
3. **Create the missing `partitions.csv`** with an OTA-capable layout (`factory` + `ota_0`/`ota_1` + `otadata`) now, even if unused — unlocks **BLE OTA** later (technician pushes firmware from a phone/laptop next to the node).
4. Use the **byte-12 version byte** (§5b) for safe rollouts.
5. Skip FUOTA.

---

## 6. Reliability, backups & secrets (the part that protects the dataset)

Self-hosting on one box optimizes cost; this section keeps it from optimizing away *durability*. The catastrophic failure mode isn't a 4G blip (a few 5-min points, §3) — it's a single VM that fills its disk or botches a Postgres upgrade with **no off-box backup**, losing the entire pollution dataset. Treat that with at least the rigor §3 gave the outage gap.

**Backups (Phase-1 must, not later):**
- Automated, **off-box** DB backups — `pgBackRest` or WAL-G, base + WAL, to **object storage or a Hetzner Storage Box** (a block volume on the same box/provider is *not* DR).
- Cover **both** databases (or the one co-located instance).
- **Test restores**, not just backups — an untested backup is a guess. A monthly restore-to-scratch check.
- Retention that matches the science value (the readings are long-lived; keep years, cheaply — Timescale compression already helps).

**Single box = SPOF, no HA.** Fine for Phase 1, stated plainly. When it hurts, the first HA step is a warm standby DB (streaming replication to a second cheap box), not managed everything.

**Secrets delivery to the VM — decided: GitHub Environment secrets, injected by the deploy workflow.** Hetzner has no managed secrets store, and the repo is **public**, so the goal is *zero* secret material in git (not even encrypted) and none in Terraform state. Source of truth is **GitHub Environment secrets** (`staging`, `prod`; issue #43) — they already give per-environment isolation, required-reviewer gates on `prod`, and an audit log.

Mechanism:
1. **OpenTofu provisions infra only** — box, block volume, firewall, and the deploy SSH key. **No app secrets as Terraform variables** (keeps them out of TF state, a common footgun). Cloud-init installs Docker + fetches the repo; it carries no secrets.
2. **The environment-gated deploy job** (GitHub Actions) holds that environment's secrets, renders them into `/etc/aq/app.env` on the box over SSH (`install -m600`, deploy-user-owned, on the encrypted volume), then `docker compose --env-file /etc/aq/app.env up -d`.
3. **Rotation** = update the GitHub Environment secret → re-run the deploy workflow. No box login needed.
4. **LoRaWAN session keys** stay in the `lorawan_keys` Docker volume (never committed), as today.

*Why this over SOPS + age:* for a public repo, keeping no secret material in git at all is the simpler, safer story, and GitHub Environments are already our CI secret store with protection rules. **SOPS + age** (secrets committed encrypted, decrypted on-box at boot) is the documented fallback if we later want GitOps-style, PR-reviewed secret management or move CD off GitHub Actions.

**Also from building the local stack:** pin the dev LGTM image tags — we hit `grafana/tempo:2` not existing and `tempo:2.10` requiring Kafka; unpinned `latest` will surprise a future contributor. (Currently pinned to `tempo:2.6.1`.)

---

## Funding (optional, parallel track)

- **DO Open Source Credits** — needs OSI-approved license (AGPL-3.0 ✓). Tiered by GitHub stars: ~$60/yr at <500★, up to more with traction. Low effort, worth filing.
- **DO for Nonprofits & Social Enterprises** — **$2,500** one-time (1 yr) + 20% Cloudways. Requires registered nonprofit status (verified via Percent).
- **AWS Nonprofit Credit Program** (~$5k/yr recurring) + **AWS Imagine Grant**; **Microsoft/Azure for Nonprofits** (~$3.5–10k/yr) — larger and recurring, if TripoliLabs registers as a nonprofit. Credits stack across providers.
- **Strategy:** run on Hetzner as the sustainable baseline; spend any credits on extras (managed Postgres HA/backups, a warm standby) so we never depend on a 12-month credit clock for baseline cost.

---

## Suggested implementation order (for the next session)

1. **`infra/`** — one OpenTofu Hetzner module (CX42 + block volume + firewall + cloud-init running `docker-compose.yml`), instantiated for `staging` (with the simulator) and `prod` (real hardware); verify `hcloud` access.
2. **Backups + secrets delivery (§6)** — pgBackRest/WAL-G off-box **with a tested restore**, plus a secrets mechanism (SOPS+age or cloud-init env). Do this *with* infra, not after — the box shouldn't run unbacked.
3. **Broker swap** — Mosquitto in `mqtt/` + compose (local + prod), update `architecture.md`.
4. **Observability wiring** — mount `config.cloud.alloy` + `GRAFANA_CLOUD_*` in the deployment (collector, configs, dashboards are already built); add the first few alerts (§4).
5. **Firmware `partitions.csv`** — create the missing OTA-capable layout (also fixes `pio run` today).
6. **Downlink config schema** — command handling in firmware + a way to enqueue downlinks via ChirpStack.
7. **Payload versioning** — start using byte 12; plan the single-source C+TS codec generator before adding the next sensor.

> When each of these lands, promote the decision to a formal ADR in `architecture.md`.
