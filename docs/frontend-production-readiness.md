# Frontend Production Readiness

Tracking doc for what the Vue 3 dashboard (`apps/dashboard/`) needs before it's production-grade.

**Current state (2026-06-27):** Architecturally solid prototype (~8/10 bones), but prototype-grade in the ways that separate "nice demo" from "production." Runs entirely on mock data (`src/mock/simulator.ts`); the backend it should talk to is still scaffolding. `axios` and `socket.io-client` are already dependencies but unused.

Legend: 🔴 blocker · 🟡 important · 🟢 nice-to-have

---

## 1. Decouple from mock data — introduce an API service layer 🔴

The single highest-value change. Today the Pinia store imports the simulator directly (`src/stores/sensors.ts:8`) and ~6 files import from `@mock`. Swapping to the real API currently means rewriting store internals, not flipping a flag.

- [ ] Create `src/services/` with a typed client interface (e.g. `SensorService`) exposing `getSensors()`, `getReadings(id, range)`, `getLatest()`, plus a realtime `subscribe()` channel.
- [ ] Two implementations behind the same interface: `MockSensorService` (wraps current simulator) and `HttpSensorService` (axios + socket.io-client).
- [ ] Select implementation via env (`VITE_API_URL` present → HTTP, else mock). The store depends only on the interface.
- [ ] Move all `@mock` imports behind the service; no component imports mock data directly.
- [ ] Define DTO types shared with the backend (consider generating from the NestJS OpenAPI/Swagger schema to avoid drift).

## 2. Tests 🔴

Vitest is fully wired (`test`, `test:ui`, `test:coverage` scripts) but there is **not a single `.spec.ts`/`.test.ts`**.

- [ ] Unit-test composables first — `useAqi` (thresholds/colors/categories) and `useDataExport` (CSV/date logic) are pure and high-value.
- [ ] Test the Pinia store: aggregation (`NeighborhoodSummary`), filtering, simulation lifecycle.
- [ ] Component tests with `@vue/test-utils` for the data-heavy ones (`SensorTable`, `AqiBadge`, chart wrappers — mock ECharts).
- [ ] Add a CI job that runs `bun run test` and fails on coverage regression. Target ~60% on critical paths to start.

## 3. Accessibility 🔴

Zero `aria-*` or `role` attributes in the entire app. Charts and map markers have no keyboard support or text alternatives.

- [ ] ARIA labels on all interactive elements (buttons, map markers, language/theme toggles, table sort headers).
- [ ] Text/data-table alternative for each chart (ECharts has an `aria` + decal option — enable it).
- [ ] Keyboard navigation for the map and any custom controls; visible focus states.
- [ ] Verify color-contrast on AQI badges in both light and dark mode (WCAG AA).
- [ ] Run axe-core (or `vitest-axe`) in component tests to prevent regressions.

## 4. Error handling & resilience 🟡

`fetch` calls fail silently (`src/App.vue:61`, `src/views/LandingView.vue`). No error states, retries, or boundaries.

- [ ] Loading / error / empty states for every async view (not just happy path).
- [ ] Global error boundary (`onErrorCaptured` at app root) + user-facing toasts (PrimeVue Toast is already available).
- [ ] Reconnect/backoff logic for the WebSocket once realtime is wired.
- [ ] Surface "stale data" when a sensor stops reporting rather than showing last value silently.

## 5. Fix duplication & inconsistencies 🟡

- [ ] **Battery % is computed two different ways** — `SensorDetailView.vue:50` uses `((mv-3200)/1000)*100` unclamped, while `HealthView.vue:24` clamps to 0–100. Extract a single `useBattery`/`batteryPercent()` helper and use everywhere.
- [ ] Centralize magic numbers: the `288` (24h of 5-min readings) appears in both `simulator.ts` and `sensors.ts`; battery voltage range (3200–4200 mV) is repeated. Move to a `src/constants/` module.
- [ ] Audit chart components for repeated ECharts boilerplate; extract a shared base/options factory.

## 6. Performance 🟡

- [ ] `SensorMap.vue` (~line 298) uses a `{ deep: true }` watcher that rebuilds an array every tick — fine at demo scale, costly at 50+ sensors. Watch targeted fields or diff by sensor id.
- [ ] Use ECharts incremental/`setOption` merge updates instead of rebuilding full config on each data point.
- [ ] Cap in-memory history per sensor (ring buffer) so long sessions don't grow `history[]` unbounded.
- [ ] Confirm `shallowRef` is used for all chart/map instances (simulator already does this well).

## 7. Realtime data path 🟡

- [ ] Wire `socket.io-client` to the backend WebSocket gateway for live readings (replaces simulator tick).
- [ ] Initial load via REST (latest + recent history), then switch to WebSocket for updates.
- [ ] Handle out-of-order / duplicate readings and clock skew.

## 8. Build, config & deployment 🟢

- [ ] Validate required env vars at startup (fail fast if `VITE_API_URL` missing in prod build).
- [ ] Review `nginx.conf` for SPA fallback, gzip/brotli, cache headers, and security headers (CSP, etc.).
- [ ] Bundle-size budget in CI; lazy-load heavy deps (MapLibre, ECharts) per-route (routes are already lazy — verify the heavy libs are too).
- [ ] Source maps + an error-reporting hook (Sentry or similar) for production.

## 9. Observability & UX polish 🟢

- [ ] Skeleton loaders for charts/map on first paint.
- [ ] Offline / degraded-network indicator (relevant given the Lebanon connectivity context).
- [ ] Confirm RTL (Arabic) layout across every view, not just text — check charts, tables, map controls.
- [ ] SEO/meta + social cards for the public landing page.

---

## Suggested order

1. **API service layer (§1)** — unblocks everything else and the backend integration; do it first.
2. **Tests (§2)** — lock in behavior before refactoring further.
3. **Accessibility (§3)** and **error handling (§4)** — the two biggest "demo → product" gaps.
4. **Realtime path (§7)** once the backend gateway exists.
5. Duplication/perf/build polish (§5, §6, §8, §9) as ongoing cleanup.

> Note: §1 and §7 depend on `apps/api` + `services/ingestion` (now scaffolded against `@aq/db`/`@aq/contracts`). The frontend service layer can be built and tested against the mock implementation today, then pointed at the API when it's ready.
