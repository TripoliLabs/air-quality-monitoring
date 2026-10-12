# Dashboard (`@aq/dashboard`)

The public face of Qalawun: live air quality for Tripoli, in English and Arabic.
Vue 3, Vite, Tailwind CSS 4, MapLibre GL JS and Apache ECharts. There is no UI
kit; the components and the design tokens live in this package.

## Run it

```bash
pnpm --filter @aq/dashboard dev      # http://localhost:5173, on simulated data
pnpm --filter @aq/dashboard test     # unit tests (Vitest)
pnpm --filter @aq/dashboard lint     # ESLint
pnpm --filter @aq/dashboard build    # type-check and production build
```

## Where the data comes from

| How it is run                                        | Data source                                                |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`, nothing configured                       | In-browser mock. A dark strip at the top says so.          |
| `pnpm dev` with `VITE_API_URL=http://localhost:3000` | The live API at that address.                              |
| `pnpm dev` with `VITE_DATA_SOURCE=api`               | The live API through the dev proxy (`/api`, `/socket.io`). |
| Any production build                                 | The live API, always.                                      |

A production build cannot show simulated data: the mock is loaded behind
`import.meta.env.DEV`, so the build drops it from the bundle
(`src/services/index.ts`, checked by `test/config.test.ts`).

By default a production build calls the API on its own origin: `/api/*` for REST
and `/socket.io` for live readings. `nginx.conf` proxies both to the `api`
service. Set `VITE_API_URL` at build time only if the API is on another host.
All settings are listed in `.env.example`.

## How it stays live

`src/stores/air.ts` holds the sensors, their latest readings and the state of
the connection. Every page derives what it shows from that one store, so a
reading updates the headline, the map, the lists and any open chart at once.

1. Socket.IO pushes each reading as it is stored.
2. If the socket drops, the store polls `GET /sensors/latest` every 30 seconds
   and resyncs when the socket returns.
3. The sensor list is refreshed every five minutes, and at once when an unknown
   sensor reports, so newly registered sensors appear without a reload.
4. A sensor counts as reporting if its last reading is under 15 minutes old
   (the same window the API uses). A clock in the store re-evaluates this, so a
   sensor that goes quiet turns "not reporting" on its own.

History is loaded on demand: raw readings for the last 24 hours of one sensor
and hourly aggregates for longer ranges. City and neighborhood charts use
`GET /overview/history`, one request each, and are re-read every five minutes.

## Layout of the code

```
src/
  lib/          pure logic, no Vue: AQI scale, metric registry, statistics,
                formatting, place names, export, config
  services/     the data boundary (SensorService) and its live-API implementation
  mock/         the development-only implementation and its air model
  stores/       air.ts — the live picture of the network
  composables/  language, theme, AQI wording, sorting
  components/   building blocks (SkyPanel, BreezeCanvas, SensorMap, TrendChart …)
  views/        one file per page
  i18n/         en.ts and ar.ts
  style.css     design tokens and base styles
test/           unit tests
```

## Extending it

**A new measurement** (for example NO₂): add the field to `Reading` in
`src/types.ts`, map it in `src/services/http-sensor-service.ts`, add one entry
to `METRICS` in `src/lib/metrics.ts`, and add its name in both `i18n` files.
The map layers, charts and switches are built from the registry.

**A new page**: add the view, a route in `src/router.ts`, and (if it belongs in
the main navigation) one entry in `NAV_ITEMS`. The header and the mobile tab
bar both render from that list.

**A new language**: add `src/i18n/<code>.ts` with the same keys (the test in
`test/i18n.test.ts` compares them), register it in `src/i18n/index.ts`, and add
it to `Locale` and to `usePrefs`. Layout uses logical properties (`ps-`, `ms-`,
`start-`), so a right-to-left language needs no layout work.

**A new data source**: implement `SensorService`.

**A new neighbourhood name in Arabic**: add it to `src/lib/places.ts`. The API
stores one Latin-script name per sensor; unknown names are shown as stored.

## Design system

- **Tokens** are CSS variables in `src/style.css`, exposed to Tailwind
  (`bg-surface`, `text-ink-2`, `border-line`, `rounded-panel` …). Components use
  the names, never raw colours, so both themes come from one place.
- **AQI colours** are in `src/lib/aqi.ts` because the map and the charts need
  them as values. `test/aqi.test.ts` checks every text and AQI colour pairing
  against WCAG AA in both themes; change a colour and the test tells you if it
  stopped being readable. A level is never shown by colour alone: it always
  comes with its number or its name.
- **Type**: Readex Pro, one variable family for Latin and Arabic, self-hosted.
- **The breeze** (`BreezeCanvas.vue`) is the signature. It is tied to the data:
  clean air is a few long, quick streaks; polluted air is a slow, dense haze
  tinted with the AQI colour. It only runs on sky panels (never behind tables
  or charts), pauses off screen and in background tabs, and is a still frame
  when the reader has asked for reduced motion.
- **Numbers** use Western digits with a decimal point in both languages; dates
  and relative times follow the language.

## Map

OpenFreeMap vector tiles of OpenStreetMap (no API key). Place labels follow the
language. To use another tile server, set `VITE_MAP_STYLE_LIGHT` and
`VITE_MAP_STYLE_DARK` to MapLibre style URLs.

## Known limits

- Sensor names come from the API in one language only.
