# Firmware — air-quality node

ESP32 firmware for the LILYGO T-Beam V1.2 (ESP32 + SX1276, EU868). It samples the
PMS7003 and BME280, encodes the 13-byte payload, sends it as a LoRaWAN uplink
(OTAA) and deep-sleeps.

Toolchain: ESP-IDF 6.1 and RadioLib 7.8. RadioLib is pinned once, in
`main/idf_component.yml`, and `main/CMakeLists.txt` is the single source list —
both build routes below use them.

## Layout

| Path | What |
|------|------|
| `core/` | Portable C: sensor HAL, payload codec, downlink config (host- and target-buildable) |
| `adapters/esp32/` | On-target drivers: PMS7003, BME280, AXP2101 PMU, LoRaWAN |
| `src/main.cpp` | On-target entrypoint |
| `main/` | ESP-IDF `main` component (source list + RadioLib dependency) |
| `sim/`, `test/` | Host simulator and unit tests |

## Host tests (no hardware)

```bash
make -C firmware test
```

## Build

```bash
# PlatformIO — the route used to flash a board
cd firmware
pio run -e tbeam-v12

# or: idf.py in the official ESP-IDF container, nothing to install
scripts/firmware-esp32-build.sh      # from the repo root
```

PlatformIO needs Python's `venv` module. On Ubuntu/Debian:
`sudo apt install python3-venv`.

## LoRaWAN keys

The DevEUI, JoinEUI and AppKey are compile-time values that default to all
zeros, so **a board flashed without them cannot join**. Create the device in
ChirpStack first, then pass its values at build time. Never commit them.

```bash
export PLATFORMIO_BUILD_FLAGS='-DAQ_LORAWAN_DEV_EUI=0x70B3D57ED0060001ULL -DAQ_LORAWAN_JOIN_EUI=0x0000000000000000ULL -DAQ_LORAWAN_APP_KEY_BYTES={0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,0x99,0xAA,0xBB,0xCC,0xDD,0xEE,0xFF}'
```

Keep each `-D...` free of spaces (PlatformIO splits the variable on whitespace)
and write the AppKey as 16 comma-separated bytes, in the order ChirpStack shows it.

## Flash and monitor

With the board on USB and the keys exported as above:

```bash
cd firmware
pio run -e tbeam-v12 -t upload
pio device monitor
```

A healthy first boot logs the PMU coming up, `initializing SX1276 radio`,
`new OTAA join`, then `uplink sent`.

## Bench test without sensors

With no sensors wired the node has nothing to report, so it skips the uplink
and never joins. To test the radio path alone, add this flag to
`PLATFORMIO_BUILD_FLAGS`:

```
-DAQ_BENCH_SEND_WITHOUT_SENSORS
```

The node then joins and sends a payload with every sensor-presence bit clear.
ChirpStack shows the join and the uplink; ingestion drops the reading as
incomplete instead of storing zeros. Leave the flag out of field builds.

## Flashing from WSL

Pass the board's USB port into WSL with `usbipd` (from an administrator
PowerShell: `usbipd bind --busid <id>` then `usbipd attach --wsl --busid <id>`).
The link is unreliable at the default 921600 baud; flash with
`PLATFORMIO_UPLOAD_SPEED=230400`.

## Hardware verification status

Verified on a LILYGO T-Beam V1.2 868 MHz (SX1276, AXP2101) against a Dragino
DLOS8N gateway and ChirpStack: PMU bring-up, radio init on the default pin map,
OTAA join, and an uplink on fPort 2 decoded by ingestion.

Not yet verified on hardware: the PMS7003 UART and BME280 I2C drivers with real
sensors attached, battery readings, deep-sleep current, and session restore
across wake cycles. The SX1262 variant of the T-Beam needs a different radio
class and pin map.
