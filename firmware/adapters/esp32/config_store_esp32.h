/**
 * Node config in NVS flash, so settings pushed over the air survive a power cut
 * (RTC RAM only survives deep sleep). See config_store_esp32.c.
 */
#ifndef AQ_CONFIG_STORE_ESP32_H
#define AQ_CONFIG_STORE_ESP32_H

#include "aq_downlink.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Load the stored config into `cfg`. 0 on success; -1 if there is none or it is
 * unreadable, and `cfg` is left untouched (the caller keeps the defaults). */
int esp32_config_load(aq_config_t *cfg);

/* Store `cfg`. 0 on success, -1 on failure. */
int esp32_config_save(const aq_config_t *cfg);

#ifdef __cplusplus
}
#endif

#endif /* AQ_CONFIG_STORE_ESP32_H */
