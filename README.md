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

| Firmware | Network | Backend | Database | Frontend | Infrastructure |
|----------|---------|---------|----------|----------|----------------|
| ![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=cplusplus&logoColor=white) | ![LoRaWAN](https://img.shields.io/badge/LoRaWAN-00A9CE?style=for-the-badge&logo=lora&logoColor=white) | ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) | ![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black) | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) |
| ![Arduino](https://img.shields.io/badge/Arduino-00979D?style=for-the-badge&logo=arduino&logoColor=white) | ![EMQX](https://img.shields.io/badge/EMQX-00B173?style=for-the-badge&logo=emqx&logoColor=white) | ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) | ![TimescaleDB](https://img.shields.io/badge/TimescaleDB-FDB515?style=for-the-badge&logo=timescale&logoColor=black) | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) | ![DigitalOcean](https://img.shields.io/badge/DigitalOcean-0080FF?style=for-the-badge&logo=digitalocean&logoColor=white) |
| ![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white) | ![ChirpStack](https://img.shields.io/badge/ChirpStack-00A8E1?style=for-the-badge&logo=chirpstack&logoColor=white) | | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) | ![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=mapbox&logoColor=white) | ![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white) |

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
│  (RAK7258)      │  Forward packets to network server
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
│  │  Python Ingestion Service                │  │
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
│  │  FastAPI (REST API)            │            │
│  └────┬───────────────────────────┘            │
│       │                                          │
│  ┌────▼──────────┐  ┌────────────────┐        │
│  │ React         │  │ Grafana        │        │
│  │ Dashboard     │  │ Monitoring     │        │
│  └───────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Tech Stack Rationale

| Component | Technology | Why |
|-----------|-----------|-----|
| **Firmware** | C++ + Arduino | Battery efficiency, proven at scale |
| **Network Server** | ChirpStack | Open source LoRaWAN, works offline |
| **Message Broker** | EMQX Serverless | Free tier, scalable, cloud-native MQTT |
| **Backend** | Python + FastAPI | Fast, async, auto-generated docs |
| **Database** | TimescaleDB | 100x compression, perfect for time-series |
| **Cache** | Redis | Sub-millisecond reads |
| **Frontend** | React + TypeScript | Modern, type-safe, great ecosystem |
| **Maps** | Mapbox GL JS | WebGL-accelerated, beautiful |
| **Hosting** | DigitalOcean | $24/month covers everything |

---

## Project Structure

```
air-quality-monitoring/
├── firmware/              # ESP32 sensor firmware (C++)
│   ├── src/
│   │   ├── main.cpp
│   │   ├── sensors/      # PMS5003, BME280 drivers
│   │   ├── lora/         # LoRaWAN communication
│   │   └── power/        # Deep sleep management
│   └── platformio.ini
│
├── backend/              # Python services
│   ├── ingestion/       # MQTT → Database pipeline
│   ├── api/             # FastAPI REST API
│   └── database/        # SQL schemas, migrations
│
├── frontend/            # React web dashboard
│   ├── src/
│   │   ├── components/  # Map, Charts, Widgets
│   │   ├── pages/       # Home, Sensor Detail, About
│   │   └── i18n/        # Arabic + English translations
│   └── package.json
│
├── gateway/             # LoRaWAN gateway setup
│   └── chirpstack/      # ChirpStack configuration
│
├── hardware/            # Physical designs
│   ├── bom/            # Bill of materials
│   ├── schematics/     # Wiring diagrams
│   └── enclosure/      # 3D models, assembly guide
│
├── monitoring/          # Grafana dashboards
│
├── docs/               # Documentation
│   ├── getting-started/
│   ├── deployment/
│   └── api/
│
├── docker-compose.yml  # Full stack deployment
├── .env.example        # Environment variables template
└── README.md          # You are here!
```

---

## Getting Started

### Prerequisites

**Hardware (for sensor development):**
- ESP32 board with LoRa (e.g., Heltec LoRa32 V3)
- PMS5003 PM sensor
- BME280 temperature/humidity sensor
- Jumper wires and breadboard

**Software:**
- [PlatformIO](https://platformio.org/) (for firmware)
- [Docker](https://www.docker.com/) (for backend)
- [Node.js 18+](https://nodejs.org/) (for frontend)
- [Python 3.12+](https://www.python.org/) (for backend services)

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

**3. Start the backend services:**
```bash
docker-compose up -d
```

This starts:
- ChirpStack (LoRaWAN server) → http://localhost:8080
- TimescaleDB (database) → localhost:5432
- Redis (cache) → localhost:6379
- EMQX Serverless (MQTT broker) → Cloud-based

**4. Run the API:**
```bash
cd backend/api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

API now available at http://localhost:8000
- Docs: http://localhost:8000/docs

**5. Run the frontend:**
```bash
cd frontend
npm install
npm run dev
```

Dashboard now available at http://localhost:5173

**6. Flash firmware to ESP32:**
```bash
cd firmware
pio run --target upload
pio device monitor  # View serial output
```

### Full Documentation

See `docs/getting-started/` for detailed guides on:
- Hardware assembly
- Sensor calibration
- Gateway setup
- Cloud deployment
- API usage

---

## Cost Breakdown

### Hardware (Per Sensor Node)

| Component | Cost (USD) |
|-----------|------------|
| ESP32 + LoRa module | TBD |
| PMS5003 PM sensor | TBD |
| BME280 temp/humidity | TBD |
| Solar panel (40W) | TBD |
| LiFePO4 battery (12V 30Ah) | TBD |
| Enclosure + mounting | TBD |
| **Total per node** | **TBD** |

### Network Infrastructure

| Item | Cost |
|------|------|
| LoRa Gateway (RAK7258) | TBD |
| DigitalOcean hosting | $24/month |
| Domain name | $12/year |
| **Total monthly** | **~$25-30** |

### Deployment Examples

- **Pilot (10 sensors):** ~TBD one-time + $30/month
- **Neighborhood (50 sensors):** ~TBD one-time + $30/month
- **City-scale (200 sensors):** ~TBD one-time + $30/month

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

- **Python:** Follow PEP 8, use type hints
- **JavaScript/TypeScript:** Use ESLint + Prettier
- **C++:** Follow Arduino style guide
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

### User Guides
- [Getting Started](docs/getting-started/) - Set up your development environment
- [Hardware Assembly](docs/hardware/) - Build a sensor node
- [API Reference](docs/api/) - Use the public API
- [Deployment Guide](docs/deployment/) - Deploy to production

### Developer Guides
- [Architecture Overview](docs/architecture/) - System design
- [Firmware Development](docs/firmware/) - ESP32 programming
- [Backend Development](docs/backend/) - Python services
- [Frontend Development](docs/frontend/) - React dashboard

### Operations
- [Maintenance Guide](docs/operations/) - Keep sensors running
- [Troubleshooting](docs/troubleshooting/) - Common issues
- [Calibration](docs/calibration/) - Sensor accuracy

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
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI library
- [Mapbox](https://www.mapbox.com/) - Maps and location services

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
