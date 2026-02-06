# Firmware ESP-IDF — Heltec LoRa32 V3 ESP32-S3

This folder contains the ESP32 sensor node firmware for TripoliLabs Air Quality Monitoring.

## Requirements
- python 3.12 version
- pip 26.0.1 version
- VS Code + PlatformIO extension (pio CLI)
- Heltec LoRa32 V3 ESP32-S3
- USB data cable (In case of flashing)

## Build

From the repository root:

```bash
# Build the firmware (default env: heltec_lora32_v3_debug)
pio run -d firmware

# Build release version
pio run -d firmware -e heltec_lora32_v3_release

```

"After Build the firmware a sdkconfig.heltec_lora32_v3_debug file will be created automatically, Be sure that CONFIG_ESPTOOLPY_FLASHSIZE_8MB=y is 8MB not 2M"

```bash
# Flash (USB). Build debug if needed, then flash to the connected board
pio run -d firmware -e heltec_lora32_v3_debug -t upload

# Flash with explicit port (COM? in Windows)
pio run -d firmware -e heltec_lora32_v3_debug -t upload --upload-port <PORT>

# Serial monitor (Connect to the board’s serial output and show ESP-IDF logs)
pio device monitor -d firmware -e heltec_lora32_v3_debug

```
