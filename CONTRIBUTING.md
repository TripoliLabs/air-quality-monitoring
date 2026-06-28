# Contributing to Air Quality Monitoring Network

First off, thank you for considering contributing to the Air Quality Monitoring Network! It's people like you who make this project possible and help create cleaner air for Tripoli.

This document provides guidelines for contributing to this project. Following these guidelines helps communicate that you respect the time of the developers managing and developing this open source project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Contributing Code](#contributing-code)
  - [Improving Documentation](#improving-documentation)
  - [Hardware Contributions](#hardware-contributions)
- [Project Layout](#project-layout)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Translation](#translation)
- [Community](#community)

---

## Code of Conduct

This project and everyone participating in it is governed by the common sense code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/TripoliLabs/air-quality-monitoring/issues) to avoid duplicates.

When creating a bug report, please include:

- **Clear descriptive title**
- **Detailed description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** (if applicable)
- **Environment details**:
  - OS and version
  - Hardware (ESP32 board model, sensor versions)
  - Software versions (firmware, api/ingestion, dashboard)
  - Browser (for dashboard issues)

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) when creating an issue.

### Suggesting Features

We love feature suggestions! Before creating a feature request:

1. Check if the feature has already been suggested
2. Consider if it aligns with the project's goals
3. Think about how it benefits the community

When suggesting a feature, include:

- **Clear use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - What other approaches did you think about?
- **Additional context** - Mockups, examples, etc.

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Contributing Code

We welcome code contributions! Here's how to get started:

1. **Find an issue** to work on, or create one
2. **Comment** on the issue to let others know you're working on it
3. **Fork** the repository
4. **Create a branch** for your feature/fix
5. **Make your changes** following our coding standards
6. **Test** your changes thoroughly
7. **Submit a pull request**

### Improving Documentation

Documentation improvements are always welcome! This includes:

- Fixing typos or clarifying existing docs
- Adding examples or tutorials
- Translating documentation to Arabic
- Creating video guides
- Improving code comments

### Hardware Contributions

Hardware contributions can include:

- Testing sensors and documenting results
- Designing improved enclosures
- Creating wiring diagrams
- Optimizing solar panel configurations
- Suggesting alternative components

---

## Project Layout

This is a **pnpm + Turborepo monorepo**. See [`docs/architecture.md`](docs/architecture.md) for the full design and the architecture decision records.

```
apps/dashboard      @aq/dashboard   — Vue 3 + Vite SPA
apps/api            @aq/api         — NestJS public REST + WebSocket API
services/ingestion  @aq/ingestion   — NestJS MQTT → decode → validate → AQI → DB pipeline
packages/*          @aq/{domain,contracts,db,telemetry-codec,observability}  — shared libraries
firmware/           ESP32 firmware (C++ / PlatformIO + ESP-IDF)
edge/ · infra/ · deploy/   — gateway config, OpenTofu, runtime composition
```

---

## Development Setup

### Prerequisites

- **Node.js 24+** (LTS) and **pnpm 11+** — run `corepack enable` to activate the version pinned in `package.json`
- **Docker** + Docker Compose (for the local backing stack)
- **PlatformIO** (firmware only): `pip install platformio`

### Install (from the repo root)

```bash
git clone https://github.com/TripoliLabs/air-quality-monitoring.git
cd air-quality-monitoring
corepack enable
pnpm install          # installs the entire workspace
cp .env .env.local    # adjust local config if needed (defaults work out of the box)
```

### Run the stack

```bash
# Full local stack in Docker (Postgres, TimescaleDB, Redis, NanoMQ, ChirpStack, api, ingestion, dashboard):
docker compose up -d
docker compose --profile observability up -d   # + Grafana / Prometheus / Loki

# …or run the backing services in Docker and an app on the host for the fastest loop:
pnpm --filter @aq/api start:dev          # API        → http://localhost:3000
pnpm --filter @aq/ingestion start:dev    # ingestion  → http://localhost:3001
pnpm --filter @aq/dashboard dev          # dashboard  → http://localhost:5173
```

### Build, lint, typecheck (whole workspace, via Turbo)

```bash
pnpm build        # build all packages + apps in dependency order
pnpm lint         # Biome (backend/packages) + ESLint (dashboard)
pnpm typecheck    # tsc / vue-tsc across the workspace
```

Shared `packages/*` compile to `dist/`; build them before running an app on the host (`pnpm build`, or let Turbo handle it).

### Firmware

```bash
cd firmware
pio run                    # build
pio run --target upload    # flash to ESP32
pio device monitor         # serial output
```

---

## Coding Standards

### TypeScript — backend & packages (`apps/api`, `services/ingestion`, `packages/*`)

- Linted and formatted with **[Biome](https://biomejs.dev/)** (`pnpm --filter @aq/<name> exec biome check --write src`)
- Strict TypeScript (`strict: true`); use explicit return types on exported functions
- Prefer `const` over `let`; never use `var`
- Maximum line length: 100 characters
- Shared logic belongs in a `packages/*` library, not duplicated across apps

```typescript
import { z } from 'zod';

export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  pm25: z.number().min(0).max(1000),
  pm10: z.number().min(0).max(1000),
  timestamp: z.iso.datetime(),
});

export type SensorReading = z.infer<typeof SensorReadingSchema>;
```

### Vue + TypeScript — dashboard (`apps/dashboard`)

- Linted with **ESLint + eslint-plugin-vue**, formatted with **Prettier** (`pnpm --filter @aq/dashboard lint` / `format`)
- Use the **Composition API** with `<script setup>` (this is Vue, not React)
- Prefer `const` over `let`; strict TypeScript
- Keep components focused; put reusable logic in composables (`src/composables/`)

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ aqi: number }>();
const category = computed(() => (props.aqi <= 50 ? 'good' : 'moderate'));
</script>

<template>
  <span :class="category">{{ aqi }}</span>
</template>
```

### C++ — firmware (`firmware/`)

- Follow the [ESP-IDF style guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/contribute/style-guide.html)
- Use `constexpr` for compile-time constants
- Comment complex logic; keep functions small and focused
- The LoRa payload byte layout is defined once in `packages/telemetry-codec` — keep firmware and that codec in sync

```cpp
constexpr int PM_SENSOR_RX = 16;
constexpr int PM_SENSOR_TX = 17;

/** Read PM2.5 and PM10 from the PMS7003 sensor. Returns ESP_OK on success. */
esp_err_t read_pm_sensor(float *pm25, float *pm10);
```

### General Guidelines

- Write self-documenting code; comment the *why*, not the *what*
- Keep functions small and focused
- Write tests for new functionality
- Update documentation alongside code changes

---

## Git Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

**Examples:**
```bash
feature/add-wind-sensor-support
fix/battery-voltage-reading
docs/update-api-examples
```

### Commit Messages

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) (checked by a Lefthook `commit-msg` hook):

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`

**Examples:**
```
feat(ingestion): decode PMS7003 payload and compute AQI
fix(api): correct sensor metadata serialization
docs(readme): update monorepo dev commands
```

Git hooks (lint, format, commit-msg) are installed automatically on `pnpm install` via [Lefthook](https://github.com/evilmartians/lefthook).

---

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines (`pnpm lint` passes)
- [ ] `pnpm typecheck` and `pnpm build` pass
- [ ] Self-review of code completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated (if applicable)
- [ ] Branch is up to date with `staging`

### Submitting a Pull Request

1. **Create PR** from your fork to the `staging` branch
2. **Fill out the template** completely
3. **Link related issues** using keywords (Fixes #123, Closes #456)
4. **Request review** from maintainers and **respond to feedback** promptly

### PR Title Format

```
<type>(<scope>): <description>
```

**Examples:**
- `feat(firmware): add support for SDS011 PM sensor`
- `fix(api): correct AQI calculation for PM10`
- `docs(readme): update installation instructions`

### Review Process

- At least one maintainer approval required
- All automated CI checks must pass
- Discussions should be resolved before merge

---

## Testing

```bash
# Whole workspace (via Turbo)
pnpm test

# A single app/package
pnpm --filter @aq/dashboard test     # Vitest
pnpm --filter @aq/api test           # (add tests under apps/api)

# Firmware
cd firmware && pio test
```

> Integration tests (a composed multi-service test run) will be added with the deployment infrastructure.

---

## Translation

Help us make this project accessible to Arabic speakers!

### Translating the Dashboard

1. Update the translations in `apps/dashboard/src/i18n/ar.ts` (mirror the keys in `en.ts`)
2. Test in Arabic mode (the app sets `document.dir = 'rtl'` automatically)
3. Submit a PR

### Translating Documentation

1. Create a translated file alongside the original (e.g. `docs/<name>.ar.md`)
2. Maintain formatting and structure
3. Submit a PR

---

## Community

### Communication Channels

- **GitHub Discussions**: General questions and discussions
- **GitHub Issues**: Bug reports and feature requests

### Getting Help

1. Check the [documentation](docs/) and [`docs/architecture.md`](docs/architecture.md)
2. Search [existing issues](https://github.com/TripoliLabs/air-quality-monitoring/issues)
3. Ask in [GitHub Discussions](https://github.com/TripoliLabs/air-quality-monitoring/discussions)

### Recognition

Contributors will be listed in release notes and thanked in project communications.

---

## License

By contributing, you agree that your contributions will be licensed under the same [AGPL-3.0 License](LICENSE) that covers the project.

---

## Questions?

Don't hesitate to ask! Create a [GitHub Discussion](https://github.com/TripoliLabs/air-quality-monitoring/discussions) or reach out to the maintainers.

Thank you for contributing to cleaner air in Tripoli!
