/**
 * ESP32 LoRaWAN adapter (on-target). Transmits the encoded payload as a
 * LoRaWAN uplink via the SX126x radio (T-Beam V1.2), 868 MHz, OTAA.
 * Stack bring-up (join, FCnt, MIC/encryption) is TODO.
 */
#include <stdint.h>

int lorawan_send_payload(const uint8_t *data, uint8_t len) {
    /* TODO: ensure joined (OTAA), then send `data`/`len` on fPort 2. */
    (void)data;
    (void)len;
    return 0;
}
