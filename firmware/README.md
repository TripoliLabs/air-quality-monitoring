# Firmware ESP-IDF — Heltec LoRa32 V3 ESP32-S3

This folder contains the ESP32 sensor node firmware for TripoliLabs Air Quality Monitoring.

## Requirements

- VS Code + PlatformIO extension
- Heltec LoRa32 V3 ESP32-S3
- USB data cable

## Build

From the repository root:

```bash
# Build the firmware (default env: heltec_lora32_v3_debug)
pio run -d firmware

# Build release version
pio run -d firmware -e heltec_lora32_v3_release

# Flash (USB). Build debug if needed, then flash to the connected board
pio run -d firmware -e heltec_lora32_v3_debug -t upload

# Flash with explicit port (COM? in Windows)
pio run -d firmware -e heltec_lora32_v3_debug -t upload --upload-port <PORT>

# Serial monitor (Connect to the board’s serial output and show ESP-IDF logs)
pio device monitor -d firmware -e heltec_lora32_v3_debug

```