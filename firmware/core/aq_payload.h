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
 *   12     version + sensor-presence bitmask   uint8
 *
 * Byte 12 (previously always 0) is now:
 *   bits 0..3  payload version (this firmware emits AQ_PAYLOAD_VERSION)
 *   bits 4..7  sensor-presence bitmask (which fields are populated)
 * so the decoder can branch on version (graceful mixed-firmware rollouts) and
 * heterogeneous fleets can advertise which sensors they carry. Legacy firmware
 * that sent 0 decodes as version 0 == the same layout with all sensors present.
 */
#define AQ_PAYLOAD_LEN 13
#define AQ_PAYLOAD_VERSION 1

/* Sensor-presence bits (high nibble of byte 12). */
#define AQ_PRESENT_PM 0x10  /* pm25 + pm10 populated */
#define AQ_PRESENT_ENV 0x20 /* temperature + humidity + pressure populated */

void aq_payload_encode(const aq_reading_t *r, uint8_t out[AQ_PAYLOAD_LEN]);

#endif /* AQ_PAYLOAD_H */
