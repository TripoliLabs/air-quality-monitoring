# Remote configuration verification — October 24, 2026

> - **Status:** Software implementation and local verification are complete.
> - **Result:** 380 distinct TypeScript cases and 121 firmware host assertions passed.
> - **E2E:** Configuration applied through ChirpStack/simulator and persisted across restart.
> - **CI:** Hosted `quality` and `integration` passed for implementation commit `625db6a`.
> - **Known limitation:** Physical hardware acceptance for #53 remains outstanding.
> - **Dependency:** Draft PR #61 depends on #59; rebase and coordinate after #59 merges.
> - **Recommendation:** Keep #61 as draft and leave #53 open until acceptance is verified.

## Source and dependency status

Branch: `feature/remote-node-configuration-api`, in the isolated
`remote-node-configuration` worktree. The original checkout was preserved, and
repository settings were not changed. The user authorized publication after the
walkthrough and second review on October 24. Upstream access is read-only, so the
submission uses the user's fork and a draft upstream pull request.

Upstream was rechecked after the regression work:

- `upstream/main`: `7de205b0749c41b6e1be0524b5ae626a7a86bcc3`.
- PR #56 remains merged; independently authored shared vectors are unchanged.
- PR #59 remains draft/open at `5878af370322b81b7c4596e4348b3296f812ec7e`.
- This work depends on #59 and reuses its firmware, codecs, and simulator.
  The ingestion report handler is the deliberate integration overlap. Rebase
  and coordinate that overlap after #59 merges before marking the PR ready.

## Completed verification

| Check | Result |
| --- | --- |
| Frozen installation | Passed; manifests and pnpm lockfile synchronized |
| `pnpm lint` | Passed |
| Shared package/support Biome check | Passed, 18 files |
| `pnpm typecheck` | Passed, 13 tasks |
| `pnpm build` | Passed, 9 tasks; existing dashboard bundle-size warning remains |
| Workspace unit tests | Passed, 296 tests across six packages |
| Codec unit tests | 91 passed; protocol vectors unchanged |
| Contracts unit tests | 52 passed |
| API `test:integration` | 59 passed across six files (includes 24 unit tests) |
| Ingestion `test:integration` | 78 passed across ten files (includes 29 unit tests) |
| Recovery/concurrency repetitions | 21 passed in each of three consecutive runs |
| Firmware host tests | 121 assertions passed in Linux container |
| Final API/ingestion Docker images | Built and started successfully |
| Workflow validation | actionlint 1.7.12 passed; downloaded binary checksum verified |
| CI unit command on Linux | Passed with JUnit output using pinned pnpm 12.9.1 |
| Turbo task input inspection | Shared test-support file included in all test task inputs |
| `git diff --check` | Passed |

The test total is 380 distinct TypeScript cases: 296 unit cases plus 84 live
integration cases. Integration script totals include their package unit tests;
those are not additional distinct cases. The regression phase added 80 cases
relative to the October 23 baseline.

Node 24.22.1 and pnpm 12.9.1 run from an isolated local tools directory because
of the older/broken global launcher. No global tool installation was replaced.
Windows checkout line endings were normalized locally to committed LF source;
unchanged files are excluded from the final content diff.

Docker failures that interrupted October 23 verification are resolved. Both
integration suites now pass against the rebuilt services. Failure injection uses
owned fixtures and isolated Redis prefixes, without stopping unrelated services
or clearing database volumes.

## Reproduced defects and minimal fixes

Each fix followed a failing regression test:

1. **Job deadline comparison:** lexicographic ISO comparison rejected valid
   timestamps with differing fractional-second formats and could accept reversed
   instants. Compare parsed instants instead; equal deadlines remain invalid.
2. **Report ordering:** equivalent ISO formatting could cause the store to ignore
   a newer report or accept an equal-time overwrite. Validate and normalize report
   timestamps to canonical ISO before the existing atomic Redis transition.
3. **MQTT timer cleanup:** a synchronous `publish()` throw left a live timeout.
   Clear the timer in `finally`, covering callback errors, success, timeout, and
   synchronous throws. Late callbacks cannot turn a failed promise into success.
4. **Startup connection cleanup:** an invalid configured application ID allocated
   a Redis reader before validation failed. Validate before allocating it.

REST response shapes, auth, setting limits, opcode/wire scaling, protocol bytes,
terminal-status semantics, and #59's cache shape remain compatible.

### Second review requested by the user

Two additional defects reproduced before fixes:

5. **Orphan deadline starvation:** 100 deadline entries without outstanding
   records permanently filled the bounded sweep, preventing a later valid expired
   request from reaching `timed_out`. The transition now removes orphan index
   entries atomically with its ownership read.
6. **Cross-device failure propagation:** one corrupt expired record made every
   worker fail before reading healthy Stream jobs. Expiration now reports errors
   per device, logs them without stopping dispatch, and advances past retained
   failures before wrapping to revisit repaired records. Corrupt state is retained
   for operator inspection rather than silently deleted.

Three new real-Redis regressions cover both defects and a full page of corrupt
records followed by repair. The active-dispatch shutdown test also releases its
controlled publication in `finally`, so an early assertion failure cannot strand
test cleanup. The full unit/API/ingestion suites, lint, shared-source lint,
typecheck, build, workflow validation, and recovery repetitions were rerun. API
and ingestion images were rebuilt and both health endpoints checked. Upstream
main and draft PR #59 were rechecked and remain at the SHAs above.

## Regression coverage

- Commands: boundaries, negative values, precision, strict bodies, normalization,
  malformed input, policy settings, and equivalent timestamp formats.
- HTTP: authentication, unknown/active/maintenance/retired sensors, concurrent
  enqueue, retained failures, response contracts, and OpenAPI descriptions.
- Dispatch: offline enqueue, transient retry success, exhausted attempts,
  abandoned/orphan/expired/malformed jobs, fallback and missing routing recovery,
  invalid routing, active/stale leases, two workers processing a batch, and using
  the owned record even when Stream data describes another setting.
- Crash window: a successful publish followed by a failed progress write can
  publish again. The tests explicitly preserve this ambiguity and never infer
  device application from publication.
- Reports: all three commands, both rejection results, boot/stale/equal/duplicate
  timestamps, wrong opcode/value, untrusted/future source time, pre-dispatch
  reports, late reports after timeout, and expiration/enqueue/report races.
- Lifecycle: disconnected broker, callback and synchronous publish errors,
  acknowledgement timeout, late callbacks, shutdown while blocked/dispatching,
  and routing from ordinary, partial, heartbeat, and report uplinks.
- Test infrastructure: bounded HTTP/Redis/MQTT connection attempts; cleanup closes
  clients and attempts all owned cleanup even when retirement or Redis reads fail.

## Continuous integration protection

The existing `.github/workflows/ci.yml` retains its `quality` and `integration`
job names and slim service scope. It adds read-only contents permissions,
15-/20-minute job timeouts, linting for shared source/support, readiness checks
for both app endpoints, consistent explicit test credentials, JUnit reports,
three recovery repetitions, bounded failure logs, seven-day failure artifacts,
and unconditional teardown. Artifact upload is pinned to the verified v7.0.2 SHA.

pnpm 12 consumes one argument separator. The exact unit command was tested on
Windows and Linux:

```sh
pnpm run test -- -- --reporter=default --reporter=junit --outputFile.junit=./test-results/unit.xml
```

Turbo's test inputs include the shared support file, preventing stale cached
unit results when support changes. Maintainers should require the `quality` and
`integration` checks before merging. Branch protection was not changed.
Repository-wide CodeQL/dependency review was excluded by user choice.

Workflow syntax and commands were validated locally. The results in this record
are local verification, not a hosted Actions result. The full ChirpStack/simulator and ESP32
cross-compilation remain outside ordinary CI as repository guidance requires.

## Full local ChirpStack/simulator exercise

After the dispatch/reconciliation fixes, an authenticated POST changed simulated
node `70b3d57ed0060003` to a 720-second interval through the real local gateway
bridge, ChirpStack queue, LoRaWAN simulator, and C firmware:

- Command: `63b2181a-204d-4673-8baf-c7489572242f`.
- Queued: `2026-10-24T15:54:19.967Z`.
- Broker publication recorded: `2026-10-24T15:54:19.969Z`, one attempt.
- Applied report: `2026-10-24T15:54:26.542Z`, interval 720.
- Terminal result: applied; outstanding state null.
- Simulator restart: fresh boot report at `2026-10-24T15:54:37.697Z`, interval
  still 720, result none/opcode 0. Terminal history remained independent.

The earlier October 23 exercise also applied interval 900 to node 2 and verified
persistence after restart. No firmware or generated C source changed in this PR;
ESP32 cross-compilation was therefore not rerun. The full generic e2e smoke script
was not run; the configuration-specific scenario above was verified directly.

After the second review fixes, the rebuilt services repeated this scenario on
node 3 with interval 780. Command `35e2d5e5-10f9-43bf-8b25-b025af35cd25` was
queued at `2026-10-24T16:56:45.080Z`, dispatched at `.082Z`, and confirmed by an
applied report at `2026-10-24T16:57:03.823Z`. After restarting the simulator, the
fresh boot report at `2026-10-24T16:57:39.877Z` retained interval 780 and reported
result none/opcode 0. The terminal command stayed applied. An ad hoc PowerShell
poll initially compared local and UTC `DateTime` values incorrectly; explicit
UTC `DateTimeOffset` assertions verified the boot report. No product change was
needed for that verification-script issue.

## Remaining acceptance and publication

Issue #53 still requires a flashed physical node: application within two uplinks
under operating conditions and persistence across reboot/power loss. Simulator
and slim-stack tests do not replace that check.

The wire has no request ID; fresh reports cannot prove unique end-to-end command
correlation. Timeouts cannot cancel commands already queued in ChirpStack, and a
crash after publication can cause duplicates. These limitations remain explicit
in operator documentation and regression assertions.

The software implementation and local verification are complete. Hardware
acceptance remains outstanding. Published as draft PR #61, dependent on #59;
keep #53 open until its remaining acceptance criteria are verified.
