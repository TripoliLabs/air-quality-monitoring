#ifndef AQ_PAYLOAD_H
#define AQ_PAYLOAD_H

#include <stdint.h>
#include "aq_reading.h"

/**
 * Uplink payload codec — the C side of the byte layout shared with
 * packages/telemetry-codec (the TS decoder). 13 bytes, little-endian:
 *
 *   0..1   pm25 × 10        uint16
 *   2..3   pm10 × 10        uint16
 *   4..5   temperature ×100 int16
 *   6..7   humidity × 100   uint16
 *   8..9   pressure (hPa)   uint16
 *   10..11 battery_mv       uint16
 *   12     reserved/flags   uint8
 */
#define AQ_PAYLOAD_LEN 13

void aq_payload_encode(const aq_reading_t *r, uint8_t out[AQ_PAYLOAD_LEN]);

#endif /* AQ_PAYLOAD_H */
