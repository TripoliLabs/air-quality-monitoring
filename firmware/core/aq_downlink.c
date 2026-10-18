#include "aq_downlink.h"

void aq_config_init(aq_config_t *cfg) {
    cfg->sample_interval_s = 300;
    cfg->pm_offset_x10 = 0;
    cfg->temp_offset_x100 = 0;
}

int aq_config_valid(const aq_config_t *cfg) {
    return cfg->sample_interval_s >= AQ_INTERVAL_MIN_S &&
           cfg->sample_interval_s <= AQ_INTERVAL_MAX_S &&
           cfg->pm_offset_x10 >= -AQ_PM_OFFSET_MAX_X10 &&
           cfg->pm_offset_x10 <= AQ_PM_OFFSET_MAX_X10 &&
           cfg->temp_offset_x100 >= -AQ_TEMP_OFFSET_MAX_X100 &&
           cfg->temp_offset_x100 <= AQ_TEMP_OFFSET_MAX_X100;
}

static uint16_t rd_u16(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}

int aq_downlink_apply(const uint8_t *buf, size_t len, aq_config_t *cfg) {
    if (buf == NULL || len < 3) {
        return AQ_DL_MALFORMED; /* every command is [cmd][16-bit argument] */
    }
    /* Apply to a copy and commit only if the result is in range. */
    aq_config_t next = *cfg;
    switch (buf[0]) {
        case AQ_CMD_SET_INTERVAL:
            next.sample_interval_s = rd_u16(&buf[1]);
            break;
        case AQ_CMD_SET_PM_OFFSET:
            next.pm_offset_x10 = (int16_t)rd_u16(&buf[1]);
            break;
        case AQ_CMD_SET_TEMP_OFFSET:
            next.temp_offset_x100 = (int16_t)rd_u16(&buf[1]);
            break;
        default:
            return AQ_DL_MALFORMED;
    }
    if (!aq_config_valid(&next)) {
        return AQ_DL_OUT_OF_RANGE;
    }
    *cfg = next;
    return AQ_DL_OK;
}
