# Air Quality Monitoring Network - Tripoli, Lebanon

<div align="center">

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Status](https://img.shields.io/badge/Status-Under%20Development-yellow)]()
[![TripoliLabs](https://img.shields.io/badge/TripoliLabs-Civic%20Tech-green)](https://github.com/TripoliLabs)

Open-source distributed air quality monitoring system using solar-powered LoRaWAN sensors to measure PM2.5, PM10, temperature, and humidity across Tripoli, Lebanon.

[Features](#-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## Tech Stack

<div align="center">

| Firmware | Network | Backend | Database | Frontend | Tooling |
|----------|---------|---------|----------|----------|---------|
| ![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=cplusplus&logoColor=white) | ![LoRaWAN](https://img.shields.io/badge/LoRaWAN-00A9CE?style=for-the-badge&logo=lora&logoColor=white) | ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) | ![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white) | ![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white) |
| ![ESP-IDF](https://img.shields.io/badge/ESP--IDF-E7352C?style=for-the-badge&logo=espressif&logoColor=white) | ![EMQX](https://img.shields.io/badge/EMQX-00B173?style=for-the-badge&logo=emqx&logoColor=white) | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) | ![TimescaleDB](https://img.shields.io/badge/TimescaleDB-FDB515?style=for-the-badge&logo=timescale&logoColor=black) | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) | ![Biome](https://img.shields.io/badge/Biome-60A5FA?style=for-the-badge&logo=biome&logoColor=white) |
| ![PlatformIO](https://img.shields.io/badge/PlatformIO-F5822A?style=for-the-badge&logo=platformio&logoColor=white) | ![ChirpStack](https://img.shields.io/badge/ChirpStack-00A8E1?style=for-the-badge&logo=chirpstack&logoColor=white) | | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) | ![MapLibre](https://img.shields.io/badge/MapLibre-396CB2?style=for-the-badge&logo=maplibre&logoColor=white) | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) |

</div>

---

## About

This project creates a network of **solar-powered air quality sensors** that transmit data via **LoRaWAN** to provide real-time air quality information for Tripoli and North Lebanon. All data is publicly accessible through open APIs and interactive dashboards.

### Why This Matters

Lebanon faces severe air quality challenges from:
- Traffic congestion
- Illegal diesel generators (due to power grid failures)
- Industrial pollution
- Dust storms

**Yet there's minimal official air quality monitoring.** This project fills that gap with community-driven, open-source infrastructure.

### Our Goals

- Measure PM2.5 and PM10 particulate pollution across neighborhoods
- Identify pollution sources (diesel generators, traffic, dust storms)
- Provide real-time health advisories to residents
- Support evidence-based environmental policy
- Enable community-driven environmental monitoring

---

## Features

### Current Status: Under Active Development

- [x] System architecture designed
- [x] Technology stack selected
- [x] Repository structure created
- [ ] ESP32 firmware (in progress)
- [ ] Backend services (planned)
- [ ] Web dashboard (planned)
- [ ] Field deployment (planned)

### Planned Capabilities

**Hardware:**
- Solar-powered sensor nodes (3-5 days autonomy)
- LoRaWAN long-range communication (5-10km)
- Operates independently of grid power
- Measures PM2.5, PM10, temperature, humidity

**Software:**
- Interactive real-time map dashboard
- Historical data visualization and analysis
- Health advisory alerts
- Mobile-responsive design
- Bilingual interface (Arabic + English)
- Open data API

**Network:**
- City-scale coverage (100+ sensors planned)
- Neighborhood-level resolution (300-500m spacing)
- Dense clusters for pollution source detection (50-100m)

---

## Architecture

### System Overview

```
┌─────────────────┐
│  ESP32 Sensors  │  Solar-powered nodes measuring air quality
│  + LoRa + Solar │  Send data every 5 minutes via LoRaWAN
└────────┬────────┘
         │ LoRaWAN (868MHz, 5-10km range)
         │
┌────────▼────────┐
│  LoRa Gateways  │  3-5 gateways cover entire city
│  (RAK7268)      │  Forward packets to network server
└────────┬────────┘
         │ Internet (UDP/MQTT)
         │
┌────────▼────────────────────────────────────────┐
│  Cloud Server (DigitalOcean)                    │
│  ┌──────────────────────────────────────────┐  │
│  │  ChirpStack (LoRaWAN Network Server)     │  │
│  │  Decrypts, deduplicates, validates data  │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐  │
│  │  NestJS Ingestion Service                │  │
│  │  Processes data, calculates AQI          │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
│       ┌─────────┴──────────┐                    │
│       │                    │                     │
│  ┌────▼────────┐    ┌──────▼──────┐            │
│  │ TimescaleDB │    │ Redis Cache │            │
│  │ (Storage)   │    │ (Real-time) │            │
│  └────┬────────┘    └──────┬──────┘            │
│       │                    │                     │
│  ┌────▼────────────────────▼──────┐            │
│  │  NestJS (REST API)             │            │
│  └────┬───────────────────────────┘            │
│       │                                          │
│  ┌────▼──────────┐  ┌────────────────┐        │
│  │ Vue.js        │  │ Grafana        │        │
│  │ Dashboard     │  │ Monitoring     │        │
│  └───────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Tech Stack Rationale

| Component | Technology | Version | Why |
|-----------|-----------|---------|-----|
| **Runtime** | Node.js | 24+ LTS | Long-term support, stable for production |
| **Package Manager** | pnpm | 11+ | Strict node_modules, catalogs, fast Docker caching |
| **Monorepo** | Turborepo | - | Task graph + caching, affected-graph CI |
| **Backend Linting** | Biome | 2.5+ | 30x faster than ESLint+Prettier, type-aware |
| **Frontend Linting** | ESLint + Prettier | 9+ | Full Vue template support with eslint-plugin-vue |
| **Firmware** | C++ + ESP-IDF | 5.x | Battery efficiency, ULP coprocessor support, proven at scale |
| **Network Server** | ChirpStack | 4.x | Open source LoRaWAN, works offline |
| **Message Broker** | EMQX (prod) / NanoMQ (local) | - | Scalable cloud MQTT; lightweight local broker |
| **Backend** | NestJS | 11+ | Type-safe, modular architecture, great DX |
| **Language** | TypeScript | 5.9+ | Type safety, excellent tooling |
| **Telemetry DB** | TimescaleDB on TigerData | 2.x | 100x compression, continuous aggregates, retention |
| **Relational DB** | DO Managed PostgreSQL | 16 | App metadata + ChirpStack state |
| **Cache** | Redis | 7.x | Sub-millisecond reads |
| **Frontend** | Vue.js | 3.5+ | Lightweight, reactive, intuitive API |
| **Build Tool** | Vite | 7+ | Fast HMR, optimized builds |
| **Maps** | MapLibre GL JS | 4+ | Open source, no API keys, WebGL-accelerated |
| **Hosting** | DigitalOcean | - | $24/month covers everything |

---

## Project Structure

pnpm + Turborepo monorepo (see [`docs/architecture.md`](docs/architecture.md) for the full rationale):

```
air-quality-monitoring/
├── apps/
│   ├── dashboard/        # Vue 3 + Vite SPA            (@aq/dashboard)
│   └── api/              # NestJS public REST + WS      (@aq/api)
├── services/
│   └── ingestion/        # NestJS MQTT pipeline         (@aq/ingestion)
├── packages/             # shared TypeScript libraries
│   ├── domain/           # @aq/domain — AQI calc, types
│   ├── contracts/        # @aq/contracts — Zod schemas
│   ├── db/               # @aq/db — Drizzle (relational + telemetry)
│   ├── telemetry-codec/  # @aq/telemetry-codec — LoRa payload codec
│   └── observability/    # @aq/observability — logger / OTel
├── firmware/             # ESP32 sensor firmware (C++, PlatformIO)
├── edge/chirpstack/      # ChirpStack (LoRaWAN) configuration
├── infra/                # OpenTofu (DigitalOcean)
├── deploy/               # observability stack + on-prem provisioning
├── database/ · mqtt/     # local Postgres init · NanoMQ config
├── hardware/ · docs/     # BOMs / documentation
├── turbo.json · pnpm-workspace.yaml · tsconfig.base.json · biome.json
└── docker-compose.yml    # local full stack
```

---

## Getting Started

### Prerequisites

**Hardware (for sensor development):**
- LILYGO T-Beam V1.2 868MHz (ESP32 + LoRa + GPS + OLED)
- PMS7003 PM sensor (Plantower)
- BME280 temperature/humidity/pressure sensor
- Jumper wires and breadboard

**Software:**
- [PlatformIO](https://platformio.org/) (for firmware)
- [Docker](https://www.docker.com/) (for services)
- [Node.js 24+](https://nodejs.org/) (LTS runtime)
- [pnpm 11+](https://pnpm.io/) (package manager — `corepack enable` activates it from the repo's `packageManager` field)

### Quick Start (Development)

**1. Clone the repository:**
```bash
git clone https://github.com/TripoliLabs/air-quality-monitoring.git
cd air-quality-monitoring
```

**2. Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
nano .env
```

**3. Install dependencies (pnpm workspace, from the repo root):**
```bash
corepack enable     # activates the pnpm version pinned in package.json
pnpm install        # installs all workspaces (backend, frontend)
```

**4. Start the backing services:**
```bash
docker compose up -d                          # default stack
docker compose --profile observability up -d  # + Grafana / Prometheus / Loki
```

This starts:
- Relational Postgres → localhost:5432
- TimescaleDB (telemetry) → localhost:5439
- Redis (cache) → localhost:6379
- NanoMQ (MQTT broker) → localhost:1883
- ChirpStack (LoRaWAN server) → http://localhost:8080

**5. Run the apps (host, hot reload):**
```bash
pnpm --filter @aq/api start:dev          # API           → http://localhost:3000
pnpm --filter @aq/ingestion start:dev    # ingestion     → http://localhost:3001
pnpm --filter @aq/dashboard dev          # dashboard     → http://localhost:5173
```

…or run the full stack in Docker: `docker compose up -d` (builds api, ingestion, dashboard).

**6. Build / lint the whole workspace:**
```bash
pnpm build      # turbo: build all packages + apps
pnpm lint       # Biome (backend) + ESLint (dashboard)
```

### Pre-commit Hooks

This project uses [lefthook](https://github.com/evilmartians/lefthook) for git hooks. Hooks are installed automatically when you run `pnpm install` in the root directory.

**Pre-commit checks (run in parallel):**
- **Backend:** Biome lint/format (auto-fix) + TypeScript type checking
- **Frontend:** ESLint (auto-fix) + Prettier + Vue TypeScript type checking
- **Secrets detection:** Scans for potential credentials (optional)

**Commit message format:**
Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore, ci, build, perf

Example: feat(backend): add user authentication
```

**Pre-push checks:**
- Backend tests
- Frontend tests

**Manual commands:**
```bash
lefthook run pre-commit       # Run pre-commit on staged files
lefthook run pre-commit --all # Run on all files
```

### Continuous Integration

GitHub Actions CI runs automatically on pull requests and pushes: a single job
installs the workspace with pnpm and runs Turbo across it — `pnpm lint`,
`pnpm typecheck`, `pnpm build` — building each package/app in dependency order
and caching what hasn't changed.

**7. Flash firmware to ESP32:**
```bash
cd firmware
pio run --target upload
pio device monitor  # View serial output
```

### Full Documentation

See [`docs/architecture.md`](docs/architecture.md) for the system design and decisions.
Detailed guides (hardware assembly, calibration, gateway setup, deployment, API usage)
will be added under `docs/` as the platform matures.

---

## Cost Breakdown

### Hardware (Per Sensor Node)

| Component | Cost (USD) |
|-----------|------------|
| LILYGO T-Beam V1.2 868MHz (ESP32 + LoRa + GPS + OLED) | $29-32 |
| PMS7003 PM sensor (Plantower) | $11.50-12 |
| BME280 temp/humidity/pressure | $2.50-3 |
| 5V 2W USB Solar Panel | $3-5 |
| Samsung INR18650-30Q 3000mAh Battery | $2.90-3.10 |
| TP4056 Type-C charging module | $0.20-0.50 |
| SZOMK IP67 Waterproof Enclosure | $3-5 |
| Cable glands + wiring | $3-5 |
| **Total per node** | **~$56-65** |

### Network Infrastructure

| Item | Cost |
|------|------|
| RAK7268 WisGate Edge Lite 2 (8-ch gateway) | $139-180 |
| DigitalOcean hosting | $24/month |
| Domain name | $12/year |
| **Total monthly** | **~$25-30** |

### Deployment Examples

- **Pilot (10 sensors + 1 gateway):** ~$700-830 one-time + $30/month
- **Neighborhood (50 sensors + 2 gateways):** ~$3,100-3,600 one-time + $30/month
- **City-scale (200 sensors + 5 gateways):** ~$12,000-14,000 one-time + $30/month

**Note:** With cloud provider nonprofit credits (AWS, DigitalOcean), hosting can be $0/month for first 1-2 years.

---

## Data & API

### Real-time Data Access

All air quality data will be publicly available through:

**REST API** (Coming Soon)
```bash
# Get latest reading from all sensors
GET https://api.airquality-tripoli.org/sensors/latest

# Get historical data
GET https://api.airquality-tripoli.org/readings?start=2025-01-01&end=2025-01-31

# Get neighborhood statistics
GET https://api.airquality-tripoli.org/neighborhoods/downtown/stats
```

**WebSocket** (Real-time updates)
```javascript
const ws = new WebSocket('wss://api.airquality-tripoli.org/ws');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`Sensor ${update.device_id}: ${update.pm2_5} µg/m³`);
};
```

**OpenAQ Integration**
Data will be contributed to [OpenAQ](https://openaq.org/) for global air quality research.

### Data Format

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

---

## Contributing

We welcome contributions from developers, designers, environmental scientists, and community members!

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Areas We Need Help

- **Firmware Development** - ESP32/LoRa optimization
- **Frontend/UX** - Dashboard design, Arabic localization
- **Data Science** - Pollution source detection algorithms
- **Documentation** - Guides, tutorials, translations
- **Hardware Design** - Enclosure optimization, PCB design
- **Testing** - Field testing, calibration validation

### Development Guidelines

- **TypeScript (Backend/Frontend):** Use Biome for linting/formatting, strict type checking
- **C++:** Follow ESP-IDF style guide
- **Commits:** Use clear, descriptive commit messages
- **Tests:** Add tests for new features

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## License

### AGPL-3.0 - What This Means

This project is licensed under the **GNU Affero General Public License v3.0**.

**You CAN:**
- Use this project for any purpose (including commercial)
- Modify the code
- Run it as a service
- Charge for hosting, support, or consulting

**You MUST:**
- Keep the same AGPL-3.0 license
- Share your modifications (open source)
- Provide source code to users of your service

### Why AGPL-3.0?

We chose AGPL to ensure this project **remains open source forever**. We built this for the public good, and we want all improvements to benefit everyone.

**If you're building something open source, AGPL is as permissive as MIT!**

**If you want to close the source,** this license isn't for you—and that's intentional. We believe air quality monitoring should be a public good, not a proprietary product.

**Questions?** Read the full license: [LICENSE](LICENSE)

**TL;DR:** Keep it open, and you can do anything!

---

## Project Status & Roadmap

### Current Phase: Planning & Prototyping

**Q4 2024:**
- [x] Architecture design
- [x] Technology selection
- [x] Repository setup
- [ ] First prototype sensor
- [ ] Firmware development

**Q1 2025:**
- [ ] Backend services implementation
- [ ] Web dashboard MVP
- [ ] 5-10 sensor pilot deployment
- [ ] Gateway installation

**Q2 2025:**
- [ ] Expand to 50 sensors
- [ ] Public API launch
- [ ] Community partnerships (schools, NGOs)
- [ ] Grant applications (IBM, AWS)

**Q3-Q4 2025:**
- [ ] Scale to 100+ sensors
- [ ] Mobile enforcement clusters
- [ ] Research partnerships with universities
- [ ] OpenAQ integration

### Success Metrics

- **Coverage:** 80% of Tripoli neighborhoods monitored
- **Uptime:** >90% sensor availability
- **Community:** 1,000+ monthly dashboard users
- **Impact:** Policy changes or enforcement actions
- **Research:** Academic publications using our data

---

## Documentation

- [Architecture & Decisions](docs/architecture.md) — system design + ADRs (the canonical reference)
- [Contributing](CONTRIBUTING.md) — dev setup, coding standards, workflow
- [Frontend Production Readiness](docs/frontend-production-readiness.md) — dashboard hardening backlog
- [ChirpStack / Gateway setup](edge/chirpstack/README.md) — LoRaWAN network server
- [Infrastructure](infra/README.md) · [Deployment](deploy/README.md) — provisioning + runtime composition
- [Hardware BOM](hardware/bom/) — bill of materials

> User guides (getting started, hardware assembly, calibration, operations) will be
> added under `docs/` as the platform matures.

---

## Acknowledgments

### Inspiration

This project builds on the work of:
- **[Sensor.Community](https://sensor.community/)** - Open source air quality network
- **[OpenAQ](https://openaq.org/)** - Open air quality data platform
- **[AirGradient](https://www.airgradient.com/)** - DIY air quality monitors

### Technology Stack

Built with excellent open source software:
- [ChirpStack](https://www.chirpstack.io/) - LoRaWAN Network Server
- [TimescaleDB](https://www.timescale.com/) - Time-series database
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [MapLibre GL JS](https://maplibre.org/) - Open source maps
- [pnpm](https://pnpm.io/) - Fast, disk-efficient package manager
- [Biome](https://biomejs.dev/) - Fast linter and formatter

### Community

Special thanks to:
- The Tripoli tech community
- Environmental advocates in North Lebanon
- Open source contributors worldwide

---

## Contact & Community

### Get Involved

- **GitHub Discussions:** [Ask questions, share ideas](https://github.com/TripoliLabs/air-quality-monitoring/discussions)
- **Issues:** [Report bugs, request features](https://github.com/TripoliLabs/air-quality-monitoring/issues)
- **Email:** [Coming soon]
- **Website:** [Coming soon]

### TripoliLabs

This project is part of [TripoliLabs](https://github.com/TripoliLabs), an open source civic technology initiative in Tripoli, Lebanon.

**Other projects:**
- [Coming soon]

### Social Media

- Twitter/X: [Coming soon]
- Instagram: [Coming soon]
- LinkedIn: [Coming soon]

---

## Learn More

### Air Quality Resources

- **[WHO Air Quality Guidelines](https://www.who.int/news-room/feature-stories/detail/what-are-the-who-air-quality-guidelines)** - Health standards
- **[AirNow AQI Guide](https://www.airnow.gov/aqi/aqi-basics/)** - Understanding AQI
- **[EPA Particulate Matter](https://www.epa.gov/pm-pollution)** - PM2.5 and PM10 info

### Lebanon Air Quality

- **Current monitoring** is minimal and sporadic
- **[AQICN Lebanon](https://aqicn.org/country/lebanon/)** - What limited data exists
- **Major sources:** Diesel generators, traffic, dust, industrial

### LoRaWAN & IoT

- **[LoRa Alliance](https://lora-alliance.org/)** - LoRaWAN specifications
- **[The Things Network](https://www.thethingsnetwork.org/)** - Community LoRaWAN
- **[ChirpStack Documentation](https://www.chirpstack.io/docs/)** - Network server guide

---

## Compliance & Ethics

### Data Privacy

- **No personal data collected** - Sensors measure environment only
- **Public data by default** - All measurements are open
- **Transparent processing** - All algorithms are open source

### Environmental Impact

- **Solar powered** - Minimal environmental footprint
- **Long-lasting hardware** - Designed for 5-10 year lifespan
- **Repairable** - Open hardware designs enable repair

### Community Engagement

- **Open source** - Anyone can verify, modify, improve
- **Free access** - No paywalls for air quality data
- **Community-driven** - Decisions made transparently

---

## Call to Action

### For Residents of Tripoli

- **Host a sensor** on your building's rooftop
- **Spread the word** about the project
- **Share feedback** on dashboard features

### For Developers

- **Contribute code** to any component
- **Report issues** you find
- **Improve documentation**

### For Organizations

- **Partner with us** (schools, NGOs, government)
- **Fund sensors** for specific neighborhoods
- **Use our data** for research or advocacy

### For Funders

- **Grant opportunities** - We're seeking funding
- **Hardware donations** - Sensors, gateways, solar panels
- **Cloud credits** - DigitalOcean, AWS, Azure

**Let's build cleaner air for Tripoli, together!**

---

<div align="center">

**[⬆ Back to Top](#air-quality-monitoring-network---tripoli-lebanon)**

Made with care by the Tripoli tech community for a cleaner, healthier Tripoli

**Star this repo if you support clean air for all!**

</div>
