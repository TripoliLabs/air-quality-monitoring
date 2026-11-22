# Implementation Plan: Remote Node Configuration API and Reliable Downlink Dispatch

Project: TripoliLabs air-quality-monitoring

Issue: https://github.com/TripoliLabs/air-quality-monitoring/issues/53

Reviewed: October 24, 2026

Status: Implemented and verified locally, including regression protection. Physical-node acceptance and the first hosted CI run remain outstanding.

Second review on October 24 added three real-Redis regression cases and corrected
orphan deadline starvation and corrupt-record propagation across devices. See the
[verification record](remote-node-configuration-verification.md) for evidence and
updated results. The user authorized publication after reviewing the walkthrough.

## Upstream check and authorization

The user supplied this plan, explicitly requested implementation, and authorized
publication on October 24 after the implementation walkthrough and second review.
The account has no upstream push permission; publish through the fork and a draft
upstream pull request while PR #59 remains a dependency.

Rechecked on October 24, 2026:

- `upstream/main`: `7de205b0749c41b6e1be0524b5ae626a7a86bcc3`.
- PR #56 merged October 18, 2026: independently authored shared C/TypeScript vectors.
- PR #59 remains draft/open at `5878af370322b81b7c4596e4348b3296f812ec7e`.
- Implementation uses an isolated worktree based on #59, with an explicit dependency
  on that PR. Firmware, codec, simulator, and wire-format ownership remain with #59.
  The existing ingestion report handler is the deliberate integration point;
  changes there must be reconciled with #59 before submission upstream.

Recheck upstream/main and #59 again before submission. Prefer rebasing onto main
after #59 merges. Do not promise conflict-free integration while #59 is open.

## Goal and scope

Provide authenticated remote sensor configuration requests and public reported
configuration reads, with recoverable API → ingestion → ChirpStack dispatch.

- Strict shared request, response, tracking, and versioned dispatch contracts.
- `GET` and `POST /sensors/:deviceId/config`.
- Redis Streams with a consumer group, bounded retries, abandoned-job recovery,
  explicit terminal outcomes, and clean lifecycle handling.
- MQTT publication through ingestion's existing client.
- Conservative report reconciliation and focused tests/operator documentation.

Issue #53 accepts shared vectors instead of generated codecs; #56 supplies them.
Code generation is an optional separate follow-up. No generated-codec claim is
made by this API change. CV wording and #59's real-node work are out of scope.

## Protocol and existing work to preserve

| Frame | fPort | Length | Encoding |
| --- | --- | --- | --- |
| Telemetry | 2 | 13 | Existing little-endian version/presence layout |
| Configuration command | 10 | 3 | Opcode + unsigned/signed 16-bit argument |
| Configuration report | 11 | 9 | Version/result/opcode + interval u16 + PM i16 + temperature i16 |

Report version is 1. Offsets: version 0, lastResult 1, lastCommand 2, intervalS 3,
pmOffsetX10 5, tempOffsetX100 7. Result codes: none=0, applied=1,
out_of_range=2, malformed=3.

| Command | Opcode | Wire units | Allowed range |
| --- | --- | --- | --- |
| setInterval | 0x01 | seconds u16 | 120–21600 |
| setPmOffset | 0x02 | offset × 10 i16 | -500–500 (±50 µg/m³) |
| setTempOffset | 0x03 | offset × 100 i16 | -1000–1000 (±10 °C) |

Reuse #59's `DOWNLINK_LIMITS`, `ConfigResult`, `encodeDownlink()`,
`decodeConfigReport()`, and `encodeConfigReport()`. Preserve its persistent
`sensor:config:<normalizedDevEui>` shape. No three-/nine-byte wire change.

## Shared contracts

Strict discriminated request variants:

- `{ command: 'setInterval', seconds }`: integer 120–21600.
- `{ command: 'setPmOffset', pmOffset }`: -50–50, tenths resolution.
- `{ command: 'setTempOffset', temperatureOffset }`: -10–10, hundredths resolution.

Reject unsupported precision with a floating-point-tolerant representability
check; normalize accepted values into integer wire units for dispatch/comparison.
Do not silently round arbitrary input to another setting.

Reported state: deviceId, intervalS, pmOffset, temperatureOffset, lastCommand,
lastResult, reportedAt. Validate timestamps and wire bounds separately from
outbound hardware limits so rejection reports remain representable.

Tracking includes commandId, deviceId, command, integer wire value, queuedAt,
expiresAt, status, attempt/progress timestamps, and failure details. Statuses:
queued, dispatched, applied, rejected, failed, timed_out. Dispatched means MQTT
publication completed, not ChirpStack acceptance or device application.

Versioned internal jobs carry commandId, normalized deviceId, command, queuedAt,
expiresAt; ingestion validates them again. Export through the package entry point.
Responses expose `reported`, `outstanding`, and `latestResult`, each nullable.
POST additionally returns the accepted `commandId`. Terminal failures remain visible.

## REST API

Reuse `@AdminOnly()` and the existing API-key guard. Resolve registry metadata
first and use the normalized returned sensor.deviceId for keys and routing.

GET is public, returns 404 for unknown sensors and null for absent state.
POST returns 202 only after atomic command-record + Stream-job enqueue. Return
400 for invalid commands, 404 for unknown sensors, 409 for retired sensors or an
outstanding command. Allow active and maintenance sensors. Redis failure must not
produce a false acceptance. Keep controllers small; use a configuration service,
createZodDto schemas, and documented OpenAPI responses/errors.

## Dispatch

Use a dedicated Redis connection for blocking Stream reads so caching stays
responsive. Consumer groups distribute jobs among replicas instead of broadcasting.
For each job:

1. Parse and validate its version, identifiers, timestamps, and command.
2. Check commandId ownership and deadline atomically.
3. Resolve the real ChirpStack application ID.
4. Encode using the existing three-byte encoder.
5. Publish base64 bytes to
   `application/<applicationId>/device/<devEui>/command/down` with matching devEui,
   confirmed:false, fPort:10, QoS 1, retain:false; await completion.
6. Record progress and acknowledge according to the recovery strategy.

Cache routing from validated telemetry (including partial readings and
heartbeats) and config reports. Validate/normalize envelope and topic identifiers
and reject inconsistent routing. A validated configured application ID may be a
fallback. Never guess `airquality`; missing routing must be visible/retryable.

Streams provide recovery, not exactly-once delivery. A crash between publication
and progress recording can duplicate commands. Absolute settings make retries
idempotent in value, but airtime/reporting still change. Broker acknowledgements
do not prove ChirpStack enqueue.

## Reconciliation and lifecycle

Keep reported state without TTL and expose reportedAt. Prevent older reports
overwriting newer state where timestamp ordering evidence exists.

Never resolve a request solely because an fPort 11 report arrived. Applied
requires compatible freshness, matching opcode, and equal requested integer
wire value. Handle matching rejection separately. Boot, duplicate, stale,
mismatched, and ambiguous reports leave the request unresolved. Atomic transitions
must verify commandId so delayed handlers cannot clear newer commands.

No request ID is carried on the wire: a server UUID protects server races but
cannot prove device correlation. Use trusted event timestamps and, where
available, session-aware frame counts; do not assume counters survive rejoin or
reboot. Guaranteed correlation needs a separately coordinated versioned firmware
protocol change.

Configure deadlines/retry bounds separately from terminal-record retention.
Timeout does not cancel ChirpStack queued commands or prove the device cannot
apply them later. Document late reports, subsequent requests, and operator queue
inspection/draining requirements. Retain terminal results for a defined period.

## Optional follow-up: single-source generation

Keep out of this API change. If later implemented, distinguish generated protocol
constants/metadata from actual C/TypeScript serializers. The declarative source
must cover frame lengths, offsets, signedness, endianness, scaling, versions,
presence bits, opcodes, results, and limits. Consumers and C build dependencies
must actually use generated outputs. Add deterministic check-only parity,
rounding/saturation, malformed length, unknown-version, and legacy-v0 policies.
Preserve independently authored vectors (including negative and cross-language
rounding cases); parity tests alone do not verify bytes. Tagged variants may
legitimately share offsets. Synchronize manifests and lockfile when needed.

## Verification checklist

Execution evidence: [verification record](remote-node-configuration-verification.md).

- [x] Contracts: boundaries, precision, strict shapes, wire-vs-command bounds.
- [x] Existing codec vectors and malformed/version/result tests pass.
- [x] API auth, unknown/retired/maintenance devices, normalization, DTO/OpenAPI.
- [x] Concurrent enqueues allow one winner; enqueue failure is explicit.
- [x] Offline enqueue, restart/reclaim, competing workers, retries/failures.
- [x] Correct MQTT topic, routing before config reports, bytes, fPort, retain flag.
- [x] Boot/stale/duplicate/mismatched/applied/rejected report handling.
- [x] Atomic transitions cannot clear newer requests.
- [x] Deadline and retention behavior plus queued-downlink limitations documented.
- [x] Tests pass where executable; unavailable checks are explicitly recorded.
- [x] Code follows repository style; lint/typecheck/build pass.
- [x] Operator and implementation documentation updated.

Run relevant package tests followed by required repository checks:

```sh
pnpm --filter @aq/telemetry-codec test
pnpm --filter @aq/contracts test
make -C firmware test
pnpm --filter @aq/api run test:integration
pnpm --filter @aq/ingestion run test:integration
pnpm lint
pnpm typecheck
pnpm build
```

Read installed Turbo docs before altering its configuration/commands. Preserve
slim CI integration: it proves MQTT publication, not ChirpStack/Class-A delivery.
Run full simulator/ChirpStack validation locally. ESP32 compilation is required
locally if firmware/generated C changes are included.

- [x] Rerun both integration suites after Docker stabilizes (see verification record).

## Regression protection phase — October 24, 2026

The user authorized regression protection before publication. Completed:

- [x] Extend contracts/API validation, timestamp, policy, and failure-visibility tests.
- [x] Add recovery, malformed/orphan job, fallback, lease, competing-worker, and crash-window tests.
- [x] Cover report ordering, rejection, pre-dispatch reports, timeouts, and newer-request races.
- [x] Cover routing from all supported uplink shapes, publish timeout/errors, late callbacks, and shutdown.
- [x] Bound test connections/HTTP calls and verify cleanup still runs on failure.
- [x] Fix only defects reproduced by regression tests; preserve existing API and wire formats.
- [x] Extend existing CI jobs with shared-source lint, readiness, permissions, timeouts, reports, and diagnostics.
- [x] Include shared test support in Turbo's test inputs; verify the generated task graph includes it.
- [x] Run the recovery suite three times, validate workflow syntax, and repeat the local simulator scenario.
- [x] Prepare the final walkthrough before any commit or push.

Repository-wide security scanning and branch-protection changes remain out of
scope by user choice. Publication was authorized separately after this phase.

## Acceptance and remaining hardware check

Authenticated requests must be tracked and recoverably dispatched; replicas must
not broadcast each job; unrelated reports must not unconditionally resolve state.
GET must distinguish reported settings, outstanding commands, and terminal
outcomes. Preserve #59 compatibility and document delivery/correlation limits.

Issue #53 is not complete until a flashed physical node applies a server interval
change within two uplinks under operating conditions and retains it after a
reboot/power loss. Simulator and slim-stack tests do not replace this check.

## References

- https://github.com/TripoliLabs/air-quality-monitoring/issues/53
- https://github.com/TripoliLabs/air-quality-monitoring/pull/56
- https://github.com/TripoliLabs/air-quality-monitoring/pull/59
- https://www.chirpstack.io/docs/chirpstack/integrations/mqtt.html
- https://redis.io/docs/latest/develop/pubsub/
