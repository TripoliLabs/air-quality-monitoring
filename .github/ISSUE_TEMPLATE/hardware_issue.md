---
name: Hardware Issue
about: Report hardware-related problems or suggest improvements
title: '[HARDWARE] '
labels: hardware
assignees: ''
---

## Hardware Issue Type

**What type of hardware issue is this?**

- [ ] Sensor malfunction
- [ ] Power/battery issue
- [ ] LoRa connectivity problem
- [ ] Enclosure/physical issue
- [ ] Component compatibility
- [ ] Hardware suggestion/improvement
- [ ] Assembly/installation question
- [ ] Other: ___________

## Hardware Details

### Current Setup

**Board/MCU:**
- Model: [e.g., Heltec LoRa32 V3, TTGO LoRa32]
- Version/Revision: [e.g., V3.1]
- Chip: [e.g., ESP32-S3]

**Sensors:**
- PM Sensor: [e.g., PMS5003, SDS011]
- Temperature/Humidity: [e.g., BME280, DHT22]
- Other sensors: [e.g., BME680 for gas]

**Power System:**
- Power source: [e.g., Solar panel + battery, USB, DC adapter]
- Solar panel: [e.g., 40W polycrystalline]
- Battery: [e.g., LiFePO4 12V 30Ah]
- Charge controller: [e.g., MPPT, PWM]

**LoRa Configuration:**
- Frequency: [e.g., 868MHz, 915MHz]
- Spreading Factor: [e.g., SF7, SF9]
- Antenna: [e.g., Stock antenna, external antenna]

**Enclosure:**
- Type: [e.g., IP65 waterproof box, custom 3D printed]
- Material: [e.g., ABS plastic, metal]
- Mounting: [e.g., pole mount, wall mount]

### Firmware Version

- Firmware version: [e.g., v0.1.0, commit abc123]
- Last known working version (if applicable): [e.g., v0.0.9]

## Issue Description

**Describe the hardware issue in detail**

What is happening with the hardware? Be as specific as possible.

## Steps to Reproduce

**For hardware malfunctions, provide steps to reproduce:**

1. Power on the device
2. Wait for [X] minutes
3. Observe [behavior]
4. [Additional steps]

## Expected Behavior

**What should the hardware be doing?**

Describe the expected normal operation.

## Actual Behavior

**What is the hardware actually doing?**

Describe what's actually happening.

## Measurements/Readings

**Provide any relevant measurements or sensor readings**

<details>
<summary>Serial Monitor Output</summary>

```
Paste serial monitor output here
```

</details>

<details>
<summary>Voltage Measurements</summary>

- Battery voltage: [e.g., 12.4V]
- Solar panel voltage: [e.g., 18.5V]
- ESP32 input voltage: [e.g., 3.3V]

</details>

<details>
<summary>Sensor Readings</summary>

- PM2.5: [e.g., 25 µg/m³]
- PM10: [e.g., 42 µg/m³]
- Temperature: [e.g., 24°C]
- Humidity: [e.g., 60%]

</details>

<details>
<summary>LoRa Metrics</summary>

- Signal strength (RSSI): [e.g., -80 dBm]
- SNR: [e.g., 8 dB]
- Packets sent: [e.g., 150]
- Packets acknowledged: [e.g., 145]
- Last successful transmission: [e.g., 5 minutes ago]

</details>

## Photos/Diagrams

**Attach photos or diagrams of your hardware setup**

- [ ] Overall setup photo
- [ ] Wiring diagram
- [ ] Enclosure photo
- [ ] Problem area close-up
- [ ] Other: ___________

[Drag and drop images here]

## Environmental Conditions

**Where is the sensor deployed?**

- Location type: [e.g., Rooftop, balcony, street level]
- Exposure: [e.g., Full sun, partial shade, indoor]
- Temperature range: [e.g., 15-35°C]
- Humidity conditions: [e.g., Humid coastal area]
- Weather protection: [e.g., Covered, exposed to rain]

## Timeline

**When did this issue start?**

- First noticed: [e.g., 2025-01-15]
- Frequency: [e.g., Continuous, intermittent, only at night]
- Duration: [e.g., 3 days, 2 weeks]
- Pattern: [e.g., Gets worse in afternoon, happens after rain]

## Troubleshooting Attempted

**What have you tried to fix this issue?**

- [ ] Restarted the device
- [ ] Reflashed firmware
- [ ] Checked wiring connections
- [ ] Replaced suspected component
- [ ] Tested with multimeter
- [ ] Checked antenna connection
- [ ] Verified power supply
- [ ] Other: ___________

**Results of troubleshooting:**

Describe what happened when you tried each fix.

## Impact

**How does this affect the sensor operation?**

- [ ] Sensor completely non-functional
- [ ] Intermittent data transmission
- [ ] Inaccurate readings
- [ ] Reduced battery life
- [ ] Connectivity issues
- [ ] Physical damage risk
- [ ] Other: ___________

## Additional Context

**Any other relevant information**

- Similar issues with other sensors?
- Recent changes (firmware update, hardware modification)?
- Environmental events (thunderstorm, extreme heat)?
- Time since deployment?

## Proposed Solution

**If you have ideas for fixing this, describe them**

Hardware modifications, component replacements, configuration changes, etc.

## Component Sourcing

**For component issues or suggestions:**

- Current component: [e.g., PMS5003 from AliExpress]
- Alternative considered: [e.g., SDS011]
- Reason for change: [e.g., Better accuracy, lower cost]
- Availability in Lebanon: [e.g., Available locally, must import]
- Cost: [e.g., $15 USD]

## Safety Concerns

**Are there any safety concerns?**

- [ ] Electrical hazard
- [ ] Fire risk
- [ ] Chemical/battery leakage
- [ ] Physical danger (sharp edges, weight)
- [ ] None identified

**If yes, please describe:**

## Bill of Materials Impact

**Would this change affect the BOM?**

- [ ] Yes - new component needed
- [ ] Yes - component replacement
- [ ] No change to BOM
- [ ] Cost increase/decrease: [e.g., +$5, -$3]

## Related Issues

**Link to related issues:**

- Related to #[issue number]
- Similar to #[issue number]

## Checklist

Before submitting, please check:

- [ ] I have searched for similar hardware issues
- [ ] I have provided detailed hardware information
- [ ] I have included relevant measurements
- [ ] I have attached photos/diagrams (if applicable)
- [ ] I have described troubleshooting attempts
- [ ] I have noted any safety concerns
