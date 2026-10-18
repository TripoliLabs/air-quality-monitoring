/**
 * LoRaWAN uplink + Class-A downlink (SX1276 via RadioLib). See lora_esp32.cpp.
 */
#ifndef AQ_LORA_ESP32_H
#define AQ_LORA_ESP32_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Largest application payload a downlink can carry (EU868, any data rate). */
#define AQ_LORAWAN_DOWNLINK_MAX 242

/* What arrived in the receive windows after an uplink. */
typedef struct {
    uint8_t received; /* 1 if a downlink with an application payload arrived */
    uint8_t fport;
    uint8_t data[AQ_LORAWAN_DOWNLINK_MAX];
    size_t len;
} aq_lorawan_downlink_t;

/* Join (or restore the session), send `data` on `fport`, and listen in RX1/RX2.
 * `down` may be NULL. 0 if the uplink was sent, -1 otherwise. */
int lorawan_send(const uint8_t *data, uint8_t len, uint8_t fport, aq_lorawan_downlink_t *down);

#ifdef __cplusplus
}
#endif

#endif /* AQ_LORA_ESP32_H */
