# The `main` component — the single source list for both build routes
# (PlatformIO: `pio run -e tbeam-v12`, and idf.py: scripts/firmware-esp32-build.sh).
# Compiles the on-target entrypoint together with the portable core (shared with
# the host build) and the ESP32 hardware adapters.
#
# lora_esp32.cpp uses RadioLib for the LoRaWAN stack. RadioLib is an ESP-IDF
# managed component (idf_component.yml), so both routes compile the real radio
# code; the `__has_include(<RadioLib.h>)` guard there only keeps a stub fallback.
idf_component_register(
  SRCS
    "../src/main.cpp"
    "../core/aq_payload.c"
    "../core/aq_node.c"
    "../core/aq_downlink.c"
    "../adapters/esp32/i2c_esp32.c"
    "../adapters/esp32/pmu_esp32.c"
    "../adapters/esp32/sensors_esp32.c"
    "../adapters/esp32/lora_esp32.cpp"
  INCLUDE_DIRS
    "../core"
    "../adapters/esp32"
  REQUIRES
    esp_driver_i2c
    esp_driver_uart
    esp_adc
    esp_timer
)
