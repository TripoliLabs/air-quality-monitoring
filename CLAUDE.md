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
ESP32 Sensors → LoRaWAN Gateway → ChirpStack → EMQX MQTT → Python Ingestion
  → TimescaleDB + Redis → FastAPI → React Dashboard
```

### Technology Stack

**Firmware:** C++ with Arduino Framework + PlatformIO (ESP32)
**Network Server:** ChirpStack v4 (self-hosted LoRaWAN network server)
**Message Broker:** EMQX Serverless (cloud-native MQTT)
**Ingestion:** Python 3.12+ with asyncio (asyncpg, aiomqtt, uvloop, orjson)
**Database:** TimescaleDB 2.13+ on PostgreSQL 16 (10-100x compression for time-series)
**Cache:** Redis 7.2 (real-time data)
**API:** FastAPI 0.108+ with Uvicorn
**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
**Maps:** MapLibre GL JS + OpenStreetMap tiles (not Mapbox - using open source alternative)
**Charts:** Recharts
**Monitoring:** Grafana + Prometheus + Loki
**Orchestration:** Docker Compose
**Python Package Manager:** UV (10-100x faster than pip, built in Rust)

### Hardware

**Microcontroller:** Heltec LoRa32 V3 (ESP32-S3 + LoRa radio)
**PM Sensor:** Plantower PMS5003
**Environment Sensor:** BME280 (temperature/humidity)
**Power:** 40W solar panel + 12V 30Ah LiFePO4 battery (3-5 days autonomy)
**Gateways:** RAK7258 (3-5 needed for city coverage, 5-10km range each)
**Enclosure:** IP65 weatherproof

## Project Structure

```
air-quality-monitoring/
├── firmware/          # ESP32 C++ code (PlatformIO)
├── backend/
│   ├── ingestion/    # Python MQTT subscriber
│   ├── api/          # FastAPI REST API
│   └── database/     # SQL schema & migrations
├── frontend/          # React + TypeScript dashboard
├── gateway/           # ChirpStack configuration
├── hardware/          # BOMs, schematics, assembly guides
├── monitoring/        # Grafana dashboards
├── docs/              # Documentation
└── docker-compose.yml # Full stack orchestration
```

## Development Commands

### Firmware (ESP32)

```bash
cd firmware
pio run                    # Build firmware
pio run --target upload    # Flash to ESP32
pio device monitor        # View serial output
pio test                  # Run tests
```

### Backend - Python (using UV)

```bash
cd backend/api
uv venv                                    # Create virtual environment
source .venv/bin/activate                  # Activate (Linux/Mac)
uv pip install -r requirements.txt         # Install dependencies
uv pip install -r requirements-dev.txt     # Install dev dependencies
pytest                                     # Run tests
pytest --cov                               # Run tests with coverage
black .                                    # Format code
ruff check .                               # Lint code
uvicorn main:app --reload                  # Start dev server
```

### Frontend

```bash
cd frontend
npm install               # Install dependencies
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm test                 # Run tests
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

### Why UV for Python?
- 10-100x faster than pip for dependency resolution
- Built in Rust for performance
- Modern replacement for pip/pip-tools
- Better dependency resolution algorithm

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

**Python:**
- Follow PEP 8
- Use type hints for all function parameters and return values
- Maximum line length: 100 characters
- Format with `black`, lint with `ruff`

**TypeScript/JavaScript:**
- Use ESLint and Prettier configurations provided
- Prefer functional components with hooks
- Use `const` over `let`, never use `var`

**C++ (Firmware):**
- Follow Arduino style guide
- Use meaningful names for variables and functions
- Keep functions small and focused
- Comment complex logic

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
5. **Python ingestion service**:
   - Subscribes to MQTT
   - Validates sensor data
   - Calculates AQI (Air Quality Index)
   - Writes to TimescaleDB
   - Updates Redis cache
6. **FastAPI** serves data from TimescaleDB/Redis
7. **React dashboard** displays real-time map + charts

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

- ChirpStack Docs: https://www.chirpstack.io/docs/
- TimescaleDB Docs: https://docs.timescale.com/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- The Things Network: https://www.thethingsnetwork.org/
- OpenAQ: https://openaq.org/

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

Last updated: October 26, 2024
