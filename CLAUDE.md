# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-source distributed air quality monitoring network for Tripoli, Lebanon using solar-powered LoRaWAN sensors to measure PM2.5, PM10, temperature, and humidity.

**Organization:** TripoliLabs
**License:** AGPL-3.0 (keeps project open source forever, prevents closed-source SaaS exploitation)
**Status:** Planning/Initial Setup Phase

## Architecture Overview

### System Data Flow

```
ESP32 Sensors → LoRaWAN Gateway → ChirpStack → EMQX MQTT → NestJS Ingestion
  → TimescaleDB + Redis → NestJS API → Vue.js Dashboard
```

### Technology Stack

**Runtime:** Node.js 24+ LTS (Krypton)
**Language:** TypeScript 5.9+
**Firmware:** C++ with ESP-IDF 5.x + PlatformIO (ESP32)
**Network Server:** ChirpStack v4 (self-hosted LoRaWAN network server)
**Message Broker:** EMQX Serverless (cloud-native MQTT)
**Backend:** NestJS 11+ (modular Node.js framework)
**Database:** TimescaleDB 2.x on PostgreSQL 16 (10-100x compression for time-series)
**Cache:** Redis 7.x (real-time data)
**Frontend:** Vue.js 3.5+ + Vite 7+ + Tailwind CSS
**Maps:** MapLibre GL JS 4+ + OpenStreetMap tiles (open source, no API keys)
**Charts:** Chart.js or ECharts
**Monitoring:** Grafana + Prometheus + Loki
**Orchestration:** Docker Compose

### Tooling

**Package Manager:** Bun (7x faster than npm, all-in-one JS runtime)
**Linting/Formatting:** Biome 2.0+ (Rust-based, replaces ESLint + Prettier)
**C++ Build:** PlatformIO (ESP32 ecosystem) + xmake (for dependencies)

### Hardware

**Microcontroller:** LILYGO T-Beam V1.2 868MHz (ESP32 + LoRa + GPS + OLED) - $29-32
**PM Sensor:** Plantower PMS7003 - $11.50-12
**Environment Sensor:** BME280 (temperature/humidity/pressure) - $2.50-3
**Power:** 5V 2W USB Solar Panel + Samsung INR18650-30Q 3000mAh + TP4056 charger
**Gateways:** RAK7268 WisGate Edge Lite 2 (8-ch SX1302) - $139-180
**Enclosure:** SZOMK IP67 Waterproof Box (130×90×25mm)
**Node Cost:** ~$56-65 per sensor node

## Project Structure

```
air-quality-monitoring/
├── firmware/              # ESP32 C++ code (PlatformIO + ESP-IDF)
│   ├── src/
│   │   ├── main.cpp
│   │   ├── sensors/      # PMS7003, BME280 drivers
│   │   ├── lora/         # LoRaWAN communication
│   │   └── power/        # Deep sleep management
│   └── platformio.ini
├── backend/               # NestJS services (TypeScript)
│   ├── src/
│   │   ├── ingestion/    # MQTT → Database pipeline
│   │   ├── api/          # REST API modules
│   │   ├── database/     # TypeORM entities, migrations
│   │   └── common/       # Shared utilities, DTOs
│   ├── package.json
│   └── biome.json        # Linting/formatting config
├── frontend/              # Vue.js + Vite dashboard
│   ├── src/
│   │   ├── components/   # Map, Charts, Widgets
│   │   ├── views/        # Home, Sensor Detail, About
│   │   └── i18n/         # Arabic + English translations
│   ├── package.json
│   ├── vite.config.ts
│   └── biome.json
├── gateway/               # ChirpStack configuration
├── hardware/              # BOMs, schematics, assembly guides
├── monitoring/            # Grafana dashboards
├── docs/                  # Documentation
└── docker-compose.yml     # Full stack orchestration
```

## Development Commands

### Firmware (ESP32)

```bash
cd firmware
pio run                    # Build firmware
pio run --target upload    # Flash to ESP32
pio device monitor         # View serial output
pio test                   # Run tests
```

### Backend - NestJS (using Bun)

```bash
cd backend
bun install                # Install dependencies (7x faster than npm)
bun run start:dev          # Start dev server with hot reload
bun run build              # Build for production
bun run start:prod         # Start production server
bun test                   # Run tests
bun run biome:check        # Lint and format check
bun run biome:fix          # Auto-fix lint and format issues
```

### Frontend - Vue.js (using Bun)

```bash
cd frontend
bun install                # Install dependencies
bun run dev                # Start dev server (http://localhost:5173)
bun run build              # Build for production
bun run preview            # Preview production build
bun test                   # Run tests
bun run biome:check        # Lint and format check
bun run biome:fix          # Auto-fix lint and format issues
```

### Biome Commands (Linting & Formatting)

```bash
bunx biome check .              # Check all files
bunx biome check --write .      # Fix all auto-fixable issues
bunx biome format .             # Format only
bunx biome lint .               # Lint only
```

### Docker (Full Stack)

```bash
docker-compose up -d                      # Start all services
docker-compose up -d chirpstack          # Start specific service
docker-compose logs -f api               # View logs
docker-compose down                      # Stop all services
docker-compose -f docker-compose.test.yml up  # Run integration tests
```

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

### Why TimescaleDB?
- 10-100x compression on time-series data
- Continuous aggregates (auto-updating materialized views)
- Real PostgreSQL with PostGIS for geospatial queries
- Automatic retention policies for data cleanup

### Why EMQX Serverless?
- Free tier supports project scale
- Cloud-native and scalable
- Better than self-hosted Mosquitto for reliability
- Modern MQTT 5.0 support

### Why MapLibre GL JS + OpenStreetMap (not Mapbox)?
- MapLibre is open source fork of Mapbox GL v1 (before license change)
- OpenStreetMap tiles are free with no API keys or usage limits
- WebGL rendering for smooth performance with 100+ sensor markers
- Aligns with AGPL-3.0 ethos and civic tech values
- Perfect for projects requiring full control and transparency

### Why Bun?
- 7x faster than npm for package installation
- All-in-one: runtime + package manager + bundler + test runner
- Native TypeScript support without transpilation
- Drop-in replacement for Node.js in most cases

### Why Biome?
- 30x faster than ESLint + Prettier combined
- Single tool for linting AND formatting
- Built in Rust for performance
- Type-aware linting since v2.0 (catches more bugs)
- Zero configuration needed for most projects

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

**TypeScript (Backend & Frontend):**
- Use Biome for linting and formatting (replaces ESLint + Prettier)
- Strict type checking enabled (`strict: true` in tsconfig)
- Use `const` over `let`, never use `var`
- Prefer functional components with Composition API (Vue)
- Maximum line length: 100 characters
- Use explicit return types on functions

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
   - Validates sensor data with class-validator
   - Calculates AQI (Air Quality Index)
   - Writes to TimescaleDB via TypeORM
   - Updates Redis cache
6. **NestJS API** serves data from TimescaleDB/Redis (REST + WebSocket)
7. **Vue.js dashboard** displays real-time map + charts

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
- Biome Docs: https://biomejs.dev/
- Bun Docs: https://bun.sh/docs

**Infrastructure:**
- ChirpStack Docs: https://www.chirpstack.io/docs/
- TimescaleDB Docs: https://docs.timescale.com/
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

Last updated: December 13, 2025
