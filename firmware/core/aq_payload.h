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
 *
 * Changing the layout: deployed nodes keep sending the old version until they
 * are reflashed, so the server must decode every version still in the field.
 *   1. Add vectors for the new version to packages/telemetry-codec/vectors and
 *      keep the old ones, which become decode-only rows.
 *   2. Teach the TS decoder the new version first, and deploy the server.
 *   3. Only then bump AQ_PAYLOAD_VERSION and change the encoder here.
 * The version is 4 bits, so retire a version from the decoder once no node
 * sends it any more.
 *
 * Both codecs are checked against the shared test vectors in
 * packages/telemetry-codec/vectors (see test/test_vectors.c): change the layout
 * there first, then here and in the TS codec.
 */
#define AQ_PAYLOAD_LEN 13
#define AQ_PAYLOAD_VERSION 1

/* Readings go up on fPort 2; config downlinks and reports use their own ports
 * (AQ_DOWNLINK_FPORT, AQ_REPORT_FPORT). */
#define AQ_DATA_FPORT 2

/* Sensor-presence bits (high nibble of byte 12). */
#define AQ_PRESENT_PM 0x10  /* pm25 + pm10 populated */
#define AQ_PRESENT_ENV 0x20 /* temperature + humidity + pressure populated */

void aq_payload_encode(const aq_reading_t *r, uint8_t out[AQ_PAYLOAD_LEN]);

#endif /* AQ_PAYLOAD_H */
