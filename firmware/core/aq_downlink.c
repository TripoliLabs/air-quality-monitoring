#include "aq_downlink.h"

void aq_config_init(aq_config_t *cfg) {
    cfg->sample_interval_s = 300;
    cfg->pm_offset_x10 = 0;
    cfg->temp_offset_x100 = 0;
}

static uint16_t rd_u16(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}

int aq_downlink_apply(const uint8_t *buf, size_t len, aq_config_t *cfg) {
    if (buf == NULL || len < 1) {
        return -1;
    }
    switch (buf[0]) {
        case AQ_CMD_SET_INTERVAL:
            if (len < 3) return -1;
            cfg->sample_interval_s = rd_u16(&buf[1]);
            return 0;
        case AQ_CMD_SET_PM_OFFSET:
            if (len < 3) return -1;
            cfg->pm_offset_x10 = (int16_t)rd_u16(&buf[1]);
            return 0;
        case AQ_CMD_SET_TEMP_OFFSET:
            if (len < 3) return -1;
            cfg->temp_offset_x100 = (int16_t)rd_u16(&buf[1]);
            return 0;
        default:
            return -1;
    }
}
