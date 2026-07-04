#include "aq_payload.h"
#include <math.h>

static void put_u16(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t)(v & 0xff);
    p[1] = (uint8_t)((v >> 8) & 0xff);
}

/* Clamp to the wire range so a negative (e.g. a calibration offset) or huge
 * value saturates instead of wrapping modulo 2^16. */
static uint16_t clamp_u16(float v) {
    if (v < 0.0f) return 0;
    if (v > 65535.0f) return 65535;
    return (uint16_t)lroundf(v);
}

static int16_t clamp_i16(float v) {
    if (v < -32768.0f) return -32768;
    if (v > 32767.0f) return 32767;
    return (int16_t)lroundf(v);
}

void aq_payload_encode(const aq_reading_t *r, uint8_t out[AQ_PAYLOAD_LEN]) {
    put_u16(&out[0], clamp_u16(r->pm25 * 10.0f));
    put_u16(&out[2], clamp_u16(r->pm10 * 10.0f));
    put_u16(&out[4], (uint16_t)clamp_i16(r->temperature * 100.0f));
    put_u16(&out[6], clamp_u16(r->humidity * 100.0f));
    put_u16(&out[8], clamp_u16(r->pressure));
    put_u16(&out[10], r->battery_mv);
    /* byte 12: version (low nibble) + sensor-presence bits (high nibble). */
    out[12] = (uint8_t)(AQ_PAYLOAD_VERSION | (r->present & 0xf0));
}
