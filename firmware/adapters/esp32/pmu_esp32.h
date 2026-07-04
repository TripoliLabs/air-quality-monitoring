/**
 * AXP2101 PMU (LILYGO T-Beam V1.2). See pmu_esp32.c. Must run BEFORE the radio,
 * or the SX1276 has no power rail and RadioLib's begin() sees a dead chip.
 */
#ifndef AQ_PMU_ESP32_H
#define AQ_PMU_ESP32_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Bring up the LoRa/GPS power rails + battery ADC. 0 on success, -1 on failure. */
int esp32_pmu_init(void);

/* Battery pack voltage from the PMU's ADC, in millivolts (0 if unavailable). */
uint16_t esp32_pmu_battery_mv(void);

#ifdef __cplusplus
}
#endif

#endif /* AQ_PMU_ESP32_H */
