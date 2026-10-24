# Remote node configuration

This API change depends on PR #59's node configuration implementation and codec.
It does not change the existing fPort 10 three-byte commands or fPort 11 nine-byte
reports. Shared C/TypeScript vectors from #56 remain the protocol verification
mechanism. See the [implementation plan](remote-node-configuration-plan.md).

## Request and read configuration

`GET /sensors/:deviceId/config` is public. `POST` on the same path requires the
existing `X-API-Key` admin credential. Both look up the registered sensor and use
its normalized DevEUI. Unknown sensors return 404. Retired sensors cannot receive
new requests (409); active and maintenance sensors can.

Send one of these exact JSON shapes (additional fields are rejected):

```json
{ "command": "setInterval", "seconds": 600 }
```

```json
{ "command": "setPmOffset", "pmOffset": -3.5 }
```

```json
{ "command": "setTempOffset", "temperatureOffset": -1.23 }
```

Interval bounds are 120–21600 integer seconds. PM offset is ±50 µg/m³ in tenths;
temperature offset is ±10 °C in hundredths. Unsupported precision, wrong types,
unknown commands and extra fields return 400. Accepted offsets are compared and
encoded in integer wire units; arbitrary values are not silently rounded.

A successful POST returns **202 Accepted**, an opaque `commandId`, and the same
three state fields returned by GET:

| Field | Meaning |
| --- | --- |
| `reported` | Last accepted node report, or null; inspect `reportedAt` for freshness |
| `outstanding` | Queued/dispatched command, or null |
| `latestResult` | Most recent terminal command outcome, or null |

Only one command can be outstanding per device. Concurrent POSTs produce one
acceptance and 409 responses for the others. The Redis script creates the record
and Stream entry atomically. Redis errors return 503; a connection loss can hide
a successful enqueue, so **GET state before retrying**. Acceptance is not evidence
of delivery, ChirpStack queue acceptance, or node application.

Tracking includes command, commandId, deviceId, integer opcode/wireValue,
queuedAt/expiresAt, attempt count, and applicable lastAttemptAt/dispatchedAt/
completedAt/failure fields. OpenAPI is available at `/docs` (`/docs-json`).

## Dispatch and recovery

API → Redis Stream `config:dispatch:v1` → ingestion group `config-dispatch` →
existing MQTT client → ChirpStack downlink queue → Class-A receive window → report.

The worker uses a dedicated blocking Redis connection. `XREADGROUP` starts from
the beginning of the Stream for a newly created group, so jobs accepted while
ingestion was offline are processed. `XAUTOCLAIM` recovers idle pending entries.
Each process has a unique consumer ID. An atomic per-command lease prevents two
workers from dispatching the same outstanding record during ordinary processing;
lease tokens fence delayed progress updates. The record's command, not mutable
Stream contents, supplies the wire bytes. Jobs are also validated on receipt.

After a broker PUBACK, the script marks the command `dispatched`, acknowledges
the Stream entry and deletes it. A recorded successful dispatch is not retried
while waiting for a report. MQTT/routing failures remain pending for a bounded
retry after the lease interval. Attempts are counted before publication, so
crashes count toward the limit. Exhausted attempts become `failed`, with retained
details. Malformed jobs are logged, acknowledged, and recorded in the bounded
`config:dispatch:invalid` diagnostic Stream (approximately 100 entries). Any
associated outstanding record still reaches its deadline.

Publication uses QoS 1, retain:false, confirmed:false, fPort:10, base64 bytes, and
`application/<applicationId>/device/<devEui>/command/down`; payload devEui agrees
with the topic. The MQTT acknowledgement is only from the broker. ChirpStack
does not confirm enqueue through this API.

There is **no exactly-once guarantee**. A crash or Redis failure after MQTT publish
but before recording dispatch can duplicate a command. A 10-second MQTT timeout
also leaves delivery uncertain: the existing persistent MQTT session can still
retransmit an unacknowledged packet after reconnect. A suspended worker can outlive
its lease; fencing cannot retract a network publication. Absolute commands are
idempotent in value, but repeats consume airtime and cause reports. The 60-second
minimum retry lease exceeds normal command/publish timeouts to reduce overlap.

## Routing and report trust

Routing is cached as `sensor:application:<devEui>` from decoded, validated
telemetry (including partial sensors and heartbeat-only frames) and configuration
reports. The topic supplies the actual ChirpStack application UUID; an optional
envelope application ID must agree. Topic/envelope DevEUIs must also agree after
normalization. Names such as `airquality`, wildcards and malformed IDs are rejected.
A validated `CHIRPSTACK_APPLICATION_ID` is a fallback before the first uplink;
without either route, retries and terminal failure are visible. After moving a
device between applications, wait for its new application's uplink before sending
configuration (or clear its old routing key and set the correct fallback).

The broker and ChirpStack integration are trusted infrastructure: restrict MQTT
publish ACLs and use authenticated TLS across network boundaries. A client able
to forge application uplinks can forge routing, timestamps and reports. Keep API,
ingestion and ChirpStack clocks synchronized. A syntactically valid timestamp is
not independently authenticated by the application.

Reports retain #59's shape in `sensor:config:<devEui>` with **no TTL**. Older/equal
timestamps cannot overwrite newer state. Without a usable source timestamp (or
with a future timestamp), a report can initialize an empty cache using receive
time, but cannot overwrite existing state or confirm a request.

Only dispatched commands can resolve. A report needs a source timestamp strictly
after the recorded publish attempt, not in the future, and a matching opcode.
Applied reports must also match the requested integer wire value. Matching
`out_of_range`/`malformed` reports become `rejected`. Boot reports (`none`), stale
reports, duplicates, other opcodes, wrong values and untrusted timestamps leave
the command outstanding. A report arriving before dispatch progress is committed
is conservatively left unresolved; a later fresh report can resolve it.

The decision and transition occur together in Redis using the current outstanding
record, so a delayed read/handler cannot delete a newly enqueued command. Lease
progress writes additionally require commandId and lease-token matches.

**Wire limitation:** reports contain no request identifier. A fresh report can
still describe an earlier identical command. Server UUIDs protect server-side
races, not end-to-end correlation. The current handler does not infer session
identity from `fCnt`; counters reset after rejoin/reboot. Guaranteed correlation
requires a separately coordinated versioned protocol change with firmware support.

## Deadlines, retention and operations

| Setting | Default | Range |
| --- | --- | --- |
| `CONFIG_COMMAND_TIMEOUT_MS` | 86400000 (24 h) | 1000–604800000 |
| `CONFIG_RESULT_RETENTION_SECONDS` | 604800 (7 days) | 60–31536000 |
| `CONFIG_DISPATCH_MAX_ATTEMPTS` | 5 | 1–100 |
| `CONFIG_DISPATCH_RETRY_MS` | 60000 | 60000–3600000 |

Set the same policy values on API and ingestion. Invalid settings fail startup.
The deadline is fixed at enqueue; retries do not extend it. GET/POST lazily expire
the target device and ingestion sweeps due records in bounded batches. Without
ingestion or API access, a due record stays stored until one resumes. Expiration
records `timed_out`, removes outstanding state and its job, and retains the last
terminal outcome for the configured period from observation. Reported state never
expires automatically. New terminal outcomes replace `latestResult`; this is not
an audit history or permanent command log.

The sweep atomically removes orphan deadline entries. A corrupt device record is
retained and logged for operator repair; it does not stop dispatch for other
devices. Bounded sweep pages advance past failures and wrap to revisit them after
repair, so a full page of corrupt records cannot monopolize expiration processing.

Timeout/failure **cannot cancel a downlink already queued in ChirpStack**. A late
report can update reported settings but does not rewrite a terminal result. A new
POST is allowed after timeout/failure; an old queued command can then apply after
it, or a fresh report of an old identical command can be mistaken for its result.
Before retrying an uncertain command, inspect/drain the device queue in ChirpStack
and check reported state. Do not treat timeout as proof that a device cannot still
apply the old command.

Redis is now command storage, not a disposable cache: use persistence, backups,
adequate memory and `maxmemory-policy noeviction`. The local compose service uses
AOF; its default every-second fsync still permits loss of recently acknowledged
writes in a host failure. Stronger durability requires appropriate Redis storage
and fsync/replication choices. All command keys and the Stream must share one
standalone Redis instance; these multi-key scripts do not support Redis Cluster.
Never manually trim unprocessed jobs. Worker acknowledgements delete completed
entries; deadlines clean expired entries. Monitor pending age, failure results,
invalid-job diagnostics and ingestion logs. Retired sensors should have any old
ChirpStack queue inspected by an operator; retirement does not retract commands.

## Verification and contribution checklist

Run codec/contracts unit tests, API/ingestion tests and repository lint/typecheck/
build as listed in the implementation plan. Redis state-machine tests use random
key prefixes. Live HTTP/MQTT tests use random registered devices and retire them
afterwards; run against a development/test stack, never production. They prove
broker publication and software reconciliation, not radio delivery.

The slim CI stack stays unchanged in scope. For full local validation, start the
ChirpStack/simulator services, wait for a fixture device to report routing, POST
an interval change, and observe a fresh fPort 11 report. Reboot the simulator to
check persistence. That remains distinct from issue #53's physical acceptance
test: a flashed node must apply a server interval change within two uplinks under
operating conditions and retain it across reboot/power loss. Do not close the
whole issue based only on simulator or integration tests.

Protocol references: [ChirpStack MQTT downlinks](https://www.chirpstack.io/docs/chirpstack/integrations/mqtt.html)
and [Redis Pub/Sub delivery semantics](https://redis.io/docs/latest/develop/pubsub/).
