# The `main` component. Compiles the on-target entrypoint together with the
# portable core (shared with the host build) and the ESP32 hardware adapters.
#
# lora_esp32.cpp uses RadioLib for the LoRaWAN stack, but is guarded with
# `__has_include(<RadioLib.h>)`: if RadioLib is not present (this lean CMake /
# `firmware-esp32-build.sh` build does not pull it by default) it compiles a stub
# and the radio is a no-op. The supported real-LoRaWAN build is PlatformIO
# (`pio run -e tbeam-v12`), where RadioLib comes from `lib_deps`. To enable real
# LoRaWAN here too, add RadioLib as an ESP-IDF managed component (idf_component.yml).
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
    driver
    esp_adc
    esp_timer
)
