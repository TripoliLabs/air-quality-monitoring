# Deployment and strategy decisions

Updated for the production deployment review in PR #60. The executable setup and
recovery instructions are in [production-deployment.md](production-deployment.md).

## 1. Hosting: one Netcup root server

Order an Ubuntu 24.04 x86-64 Netcup root server manually. The reviewer selected
Netcup because the prior hosting option was unavailable to the team in Lebanon.
Use `infra/bootstrap.sh` for repeatable setup: Docker, users, firewall, automatic
security updates and storage directories. No infrastructure provider or remote state
is needed for a single long-running server.

Production is the only hosted environment. The local Docker Compose pipeline is
our pre-production test environment, including ChirpStack and simulated LoRaWAN traffic.
There is no second server to pay for or maintain.

Self-host PostgreSQL and full-TSL TimescaleDB on the same host. TigerData remains
retired. The two-database split isolates ingestion load and remains an architectural
choice; metadata and readings are joined in the application layer. Scale out only
when measurements justify it. One server is a single point of failure; recovery
uses off-site backups, not automated failover.

## 2. MQTT and network boundaries

Use authenticated Mosquitto internally for ChirpStack, gateway bridge and ingestion.
Only Caddy HTTP/HTTPS and the gateway's 1700/udp are published by Compose. SSH is
key-only; administrator and deployment keys are separate. The deploy user has no
sudo but its Docker membership is effectively root access.

Ingestion uses a stable client ID, persistent session and QoS 1 subscription.
Production ChirpStack publishes uplinks at QoS 1 so short ingestion restarts queue
messages in Mosquitto. Broker topic ACLs isolate service identities; the API has no
MQTT identity. PR #61 owns the remote-configuration REST integration with ChirpStack.

## 3. On-prem: deferred

Keep the network server and broker on the Netcup host. Gateways forward RF traffic
over their internet connection. A persistent broker session covers server-side
consumer restarts, not gateway internet outages: unforwarded radio packets can still
be lost. Measure actual backhaul loss before investing in an on-prem server/buffer.

## 4. Observability

Forward production metrics, traces and selected application logs through Alloy to
Grafana Cloud. Retain the heavier LGTM stack for local development only. Configure
Grafana credentials in the server's `.env`, import the existing alert rules and set
contact points. Keep backup failure/staleness checks in the operational routine;
a database dump on the same disk is not disaster recovery.

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

### 5b. Payload evolution

- **✅ Byte 12 is now a version + sensor-presence bitmask** (was always `0`): low nibble = payload version, high nibble = which sensors are populated. Implemented in both C (`firmware/core/aq_payload.c`) and TS (`packages/telemetry-codec`); the decoder branches on version (v0 legacy = all-present, v1 = explicit, v2+ rejected). This unlocks graceful mixed-firmware rollouts and **heterogeneous fleets** (not every node carries every sensor).
- **⏳ Still to do — single-source codec generation:** generate both the C and TS codecs from one spec (byte layout defined once), so a new sensor is *one* edit instead of two-kept-in-sync. The C and TS codecs are still hand-mirrored — the highest-leverage structural fix before the sensor set grows.

### 5c. Feasibility limits are physics, not code

Adding scalar sensors (CO₂ SCD41, VOC/gas SGP40 or BME680, NO₂/O₃ electrochemical→ADC, noise, UV/light) is easy code-wise. The real ceilings:
- **LoRaWAN airtime / EU868 ~1% duty cycle** — bigger payloads → longer airtime → longer mandatory silence; payload max shrinks at higher SF (~51 B at SF12 up to ~222 B at SF7). At 13 B / 5 min we have lots of headroom, but it's a budget.
- **Power** — each sensor costs energy/sample; PMS7003 fan + NDIR CO₂ are heavy draws on a solar/18650 node. This is usually the true limit.
- **Range** — larger payloads may force lower SF (shorter range).

So: a handful of extra measurements per node is practical; an open-ended per-node sensor zoo is not. Design payloads around the airtime/power budget.

### 5d. Config changes via LoRaWAN downlinks (✅ built)

You **cannot** push firmware over LoRa practically, but you **can** push small **downlink commands** — implemented. A command schema (`[opcode][args]` on fPort 10: `setInterval` / `setPmOffset` / `setTempOffset`) lives in both C (`firmware/core/aq_downlink.{c,h}`, host-tested) and TS (`packages/telemetry-codec`), plus a ChirpStack enqueue helper. The simulator receives + decrypts + decodes downlinks end-to-end (verified). Extend the command set as needed.
- **Last mile (hardware):** wire `aq_downlink_apply()` into the on-chip LoRaWAN RX callback so a real node applies the config (the parser is done + host-tested; the on-target hook isn't).
- **Timing caveat:** Class A nodes only open an RX window *right after an uplink*, so a queued downlink lands up to one sample-interval later (and is gateway-duty-cycle limited). Fine for occasional config; don't expect instant.

### 5e. OTA: deferred, but prepare the ground now

**Current state:** no OTA. Deployment = physical USB flash (`pio run -t upload`). The `partitions.csv` that `platformio.ini` references (and which was missing, breaking `pio run`) is now **created** with a dual-app OTA layout (`factory` + `ota_0`/`ota_1` + `otadata`) — unused today but ready for OTA later.

**Why OTA is hard here:**
- **FUOTA** (LoRaWAN fragmented multicast update) is complex, very slow (duty-cycle throttled), power-hungry, impractical for full ESP32 images. Skip unless it becomes a hard requirement.
- **ESP32 native OTA** (`esp_https_ota`) needs IP connectivity — field nodes have none by design.

**Key insight:** adding a *new physical sensor* needs a site visit anyway (to wire it), so reflashing on-site then costs nothing extra. OTA's real value is **remote bug/logic fixes** to already-deployed nodes.

**Plan:**
1. Phase 1 (≤10 nodes): USB reflash is fine. Stabilize firmware.
2. ✅ **Downlink config channel** (§5d) — built (schema + round-trip); remaining: the on-target RX hook.
3. ✅ **`partitions.csv`** — created with an OTA-capable layout; unlocks **BLE OTA** later (technician pushes firmware from a phone/laptop next to the node).
4. ✅ **Byte-12 version byte** (§5b) — implemented for safe rollouts.
5. Skip FUOTA.

---

## 6. Deployment, backups and secrets

Follow the runbook in this order: bootstrap, verify administrator SSH, lock SSH,
install release assets, generate server secrets, configure S3/Grafana, start backing
services, deploy the first published SHA, then enable GitHub deployment.

PRs run the existing quality and integration checks. Successful CI for `main` triggers
image builds and Trivy scans before publishing SHA-tagged images. The deployment job
uses the `production` environment and only runs when repository variable
`DEPLOY_ENABLED` is `true`. It uses SSH with a pinned host key, runs migrations and
updates only the three application services. Health failures restore the preceding
application release and fail the job. Manual dispatch accepts a published full SHA.
Database migrations must remain compatible with the prior application version.

Plaintext secrets live in `/opt/aq/.env` on the server (deploy-owned, mode 600).
GitHub stores only `DEPLOY_HOST`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`; its
short-lived `GITHUB_TOKEN` authenticates image pulls. No app secrets are transferred
by CI. Keep an independent secure copy of `.env` for disaster recovery.

Nightly `pg_dump` backups cover both databases, include checksums/image metadata,
and must upload to S3-compatible storage. Keep seven days locally and configure
at least 30 days off-site initially. Restore drills run monthly in isolated containers,
including Timescale pre/post-restore functions. Phase 1 has no physical/WAL tier or
point-in-time recovery; daily successful dumps bound the normal recovery point to
roughly one day. Monitor failures and missing completed backup pairs.

## Next operational steps

1. Order and bootstrap the server, then configure DNS and server-side credentials.
2. Complete the first deployment, off-site backup and restore drill before enabling CD.
3. Configure Grafana contact points and validate real gateway/sensor uplinks.
4. Continue the firmware and codec roadmap above independently of deployment work.
