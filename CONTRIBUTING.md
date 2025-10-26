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
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
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
  - Software versions (firmware, backend, frontend)
  - Browser (for frontend issues)

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

## Development Setup

### Prerequisites

**For Firmware Development:**
```bash
# Install PlatformIO
pip install platformio

# Clone the repository
git clone https://github.com/TripoliLabs/air-quality-monitoring.git
cd air-quality-monitoring/firmware

# Build the project
pio run
```

**For Backend Development:**
```bash
# Navigate to backend
cd backend/api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies

# Run tests
pytest

# Start development server
uvicorn main:app --reload
```

**For Frontend Development:**
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Run linter
npm run lint

# Run tests
npm test
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your local configuration
```

---

## Coding Standards

### Python (Backend)

- Follow [PEP 8](https://pep8.org/)
- Use type hints for function parameters and return values
- Maximum line length: 100 characters
- Use docstrings for all public functions/classes
- Format code with `black`:
  ```bash
  black backend/
  ```
- Lint with `ruff`:
  ```bash
  ruff check backend/
  ```

**Example:**
```python
from typing import List, Optional

def calculate_aqi(pm25: float, pm10: float) -> int:
    """
    Calculate Air Quality Index from PM2.5 and PM10 measurements.

    Args:
        pm25: PM2.5 concentration in µg/m³
        pm10: PM10 concentration in µg/m³

    Returns:
        Air Quality Index value (0-500)
    """
    # Implementation here
    pass
```

### JavaScript/TypeScript (Frontend)

- Use ESLint configuration provided
- Format with Prettier
- Use functional components with hooks
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable names

**Example:**
```typescript
interface SensorReading {
  deviceId: string;
  pm25: number;
  pm10: number;
  timestamp: Date;
}

const fetchSensorData = async (deviceId: string): Promise<SensorReading> => {
  const response = await fetch(`/api/sensors/${deviceId}/latest`);
  return response.json();
};
```

### C++ (Firmware)

- Follow [Arduino style guide](https://www.arduino.cc/en/Reference/StyleGuide)
- Use meaningful variable and function names
- Comment complex logic
- Keep functions short and focused
- Use `const` for constants

**Example:**
```cpp
const int PM_SENSOR_RX = 16;
const int PM_SENSOR_TX = 17;

/**
 * Read PM2.5 and PM10 values from PMS5003 sensor
 *
 * @param pm25 Output parameter for PM2.5 reading
 * @param pm10 Output parameter for PM10 reading
 * @return true if reading successful, false otherwise
 */
bool readPMSensor(float& pm25, float& pm10) {
    // Implementation here
}
```

### General Guidelines

- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Use descriptive names for variables and functions
- Write unit tests for new functionality
- Update documentation with code changes

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
refactor/simplify-aqi-calculation
test/add-sensor-validation-tests
```

### Commit Messages

Write clear, descriptive commit messages:

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: Add BME680 gas sensor support

Implemented driver for BME680 to measure VOC levels.
Updated data model to include gas resistance readings.

Closes #123
```

```
fix: Correct deep sleep timing calculation

Fixed integer overflow in sleep duration calculation
that caused sensors to wake up too early.

Fixes #456
```

### Committing Code

1. Stage your changes:
   ```bash
   git add <files>
   ```

2. Commit with a descriptive message:
   ```bash
   git commit -m "feat: Add support for wind sensors"
   ```

3. Push to your fork:
   ```bash
   git push origin feature/add-wind-sensors
   ```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex sections
- [ ] Documentation updated (if applicable)
- [ ] No new warnings generated
- [ ] Tests added/updated and passing
- [ ] Branch is up to date with `main`

### Submitting a Pull Request

1. **Create PR** from your fork to `main` branch
2. **Fill out the template** completely
3. **Link related issues** using keywords (Fixes #123, Closes #456)
4. **Request review** from maintainers
5. **Respond to feedback** promptly
6. **Keep PR updated** with `main` branch

### PR Title Format

```
<type>(<scope>): <description>
```

**Examples:**
- `feat(firmware): Add support for SDS011 PM sensor`
- `fix(backend): Correct AQI calculation for PM10`
- `docs(readme): Update installation instructions`

### Review Process

- At least one maintainer approval required
- All automated checks must pass
- Discussions should be resolved
- Maintainers may request changes

### After Merge

- Delete your feature branch
- Close related issues (if not auto-closed)
- Celebrate your contribution!

---

## Testing

### Firmware Tests

```bash
cd firmware
pio test
```

### Backend Tests

```bash
cd backend/api
pytest
pytest --cov  # With coverage report
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Tests

```bash
# From project root
docker-compose -f docker-compose.test.yml up
```

---

## Documentation

When adding new features, please update:

- Code comments
- README.md (if applicable)
- API documentation (`docs/api/`)
- User guides (`docs/getting-started/`)
- Inline documentation

---

## Hardware Testing

If you're testing hardware:

1. **Document your setup**:
   - Component models and versions
   - Wiring diagram
   - Configuration settings

2. **Record results**:
   - Sensor readings
   - Power consumption
   - Signal strength
   - Any issues encountered

3. **Share findings**:
   - Create an issue with [Hardware] tag
   - Include photos/diagrams
   - Suggest improvements

---

## Translation

Help us make this project accessible to Arabic speakers!

### Translating Documentation

1. Create a new file: `docs/<section>/README.ar.md`
2. Translate the content
3. Maintain formatting and structure
4. Submit a PR

### Translating the Dashboard

1. Add translations to `frontend/src/i18n/ar.json`
2. Follow existing structure
3. Test in Arabic mode
4. Submit a PR

---

## Community

### Communication Channels

- **GitHub Discussions**: General questions and discussions
- **GitHub Issues**: Bug reports and feature requests
- **Email**: [Coming soon]

### Getting Help

If you need help:

1. Check the [documentation](docs/)
2. Search [existing issues](https://github.com/TripoliLabs/air-quality-monitoring/issues)
3. Ask in [GitHub Discussions](https://github.com/TripoliLabs/air-quality-monitoring/discussions)
4. Reach out to maintainers

### Recognition

Contributors will be:
- Listed in `AUTHORS.md`
- Mentioned in release notes
- Thanked in project communications

---

## License

By contributing, you agree that your contributions will be licensed under the same [AGPL-3.0 License](LICENSE) that covers the project.

---

## Questions?

Don't hesitate to ask! We're here to help. Create a [GitHub Discussion](https://github.com/TripoliLabs/air-quality-monitoring/discussions) or reach out to the maintainers.

Thank you for contributing to cleaner air in Tripoli!
