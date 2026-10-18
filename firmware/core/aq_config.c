#include "aq_config.h"

#include "aq_payload.h" /* AQ_PRESENT_* */

void aq_state_init(aq_node_state_t *st, const aq_config_t *cfg) {
    if (cfg != NULL && aq_config_valid(cfg)) {
        st->cfg = *cfg;
    } else {
        aq_config_init(&st->cfg);
    }
    st->report_pending = 0;
    st->last_cmd = 0;
    st->last_result = AQ_RESULT_NONE;
}

int aq_state_on_downlink(aq_node_state_t *st, uint8_t fport, const uint8_t *buf, size_t len) {
    if (fport != AQ_DOWNLINK_FPORT) {
        return 0;
    }
    const aq_config_t before = st->cfg;
    const int rc = aq_downlink_apply(buf, len, &st->cfg);

    st->last_cmd = (buf != NULL && len > 0) ? buf[0] : 0;
    st->last_result = rc == AQ_DL_OK           ? AQ_RESULT_APPLIED
                      : rc == AQ_DL_OUT_OF_RANGE ? AQ_RESULT_OUT_OF_RANGE
                                                 : AQ_RESULT_MALFORMED;
    st->report_pending = 1;

    /* Re-sending the active value is applied but needs no flash write. */
    return before.sample_interval_s != st->cfg.sample_interval_s ||
           before.pm_offset_x10 != st->cfg.pm_offset_x10 ||
           before.temp_offset_x100 != st->cfg.temp_offset_x100;
}

void aq_state_request_report(aq_node_state_t *st) {
    st->report_pending = 1;
}

int aq_state_report_due(const aq_node_state_t *st) {
    return st->report_pending != 0;
}

void aq_state_report_done(aq_node_state_t *st) {
    st->report_pending = 0;
}

uint32_t aq_state_sleep_s(const aq_node_state_t *st) {
    return st->report_pending ? AQ_REPORT_DELAY_S : st->cfg.sample_interval_s;
}

static void put_u16(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t)(v & 0xff);
    p[1] = (uint8_t)((v >> 8) & 0xff);
}

void aq_config_report_encode(const aq_node_state_t *st, uint8_t out[AQ_REPORT_LEN]) {
    out[0] = AQ_REPORT_VERSION;
    out[1] = st->last_result;
    out[2] = st->last_cmd;
    put_u16(&out[3], st->cfg.sample_interval_s);
    put_u16(&out[5], (uint16_t)st->cfg.pm_offset_x10);
    put_u16(&out[7], (uint16_t)st->cfg.temp_offset_x100);
}

void aq_config_calibrate(const aq_config_t *cfg, aq_reading_t *r) {
    if (r->present & AQ_PRESENT_PM) {
        r->pm25 += (float)cfg->pm_offset_x10 / 10.0f;
        if (r->pm25 < 0.0f) r->pm25 = 0.0f; /* an offset cannot make air cleaner than clean */
    }
    if (r->present & AQ_PRESENT_ENV) {
        r->temperature += (float)cfg->temp_offset_x100 / 100.0f;
    }
}
