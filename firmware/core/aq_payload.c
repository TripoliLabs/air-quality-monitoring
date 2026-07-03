#include "aq_payload.h"
#include <math.h>

static void put_u16(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t)(v & 0xff);
    p[1] = (uint8_t)((v >> 8) & 0xff);
}

void aq_payload_encode(const aq_reading_t *r, uint8_t out[AQ_PAYLOAD_LEN]) {
    put_u16(&out[0], (uint16_t)lroundf(r->pm25 * 10.0f));
    put_u16(&out[2], (uint16_t)lroundf(r->pm10 * 10.0f));
    put_u16(&out[4], (uint16_t)(int16_t)lroundf(r->temperature * 100.0f));
    put_u16(&out[6], (uint16_t)lroundf(r->humidity * 100.0f));
    put_u16(&out[8], (uint16_t)lroundf(r->pressure));
    put_u16(&out[10], r->battery_mv);
    /* This firmware carries both a PM and an environmental sensor. */
    out[12] = AQ_PAYLOAD_VERSION | AQ_PRESENT_PM | AQ_PRESENT_ENV;
}
