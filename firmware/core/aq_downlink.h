#ifndef AQ_DOWNLINK_H
#define AQ_DOWNLINK_H

#include <stddef.h>
#include <stdint.h>

/**
 * Downlink config commands — the C side of the schema shared with
 * packages/telemetry-codec (the TS encoder). Small commands pushed to a node via
 * a LoRaWAN Class-A downlink so config changes never need a reflash. Any change
 * here must be mirrored in packages/telemetry-codec.
 *
 * Sent on fPort AQ_DOWNLINK_FPORT (data uplinks use fPort 2). Format:
 *   [cmd:1][args… little-endian]
 */
#define AQ_DOWNLINK_FPORT 10

#define AQ_CMD_SET_INTERVAL 0x01    /* uint16 LE — sample interval, seconds */
#define AQ_CMD_SET_PM_OFFSET 0x02   /* int16  LE — PM2.5 calibration, µg/m³ ×10 */
#define AQ_CMD_SET_TEMP_OFFSET 0x03 /* int16  LE — temperature calibration, °C ×100 */

/* Accepted ranges. A command outside them is rejected and the config is left as
 * it was, so a typo on the server cannot strand a node. The interval floor keeps
 * a node inside the EU868 1% duty cycle at SF12 (~1.2 s per uplink); the ceiling
 * keeps it heard often enough to receive the next downlink and not look dead. */
#define AQ_INTERVAL_MIN_S 120
#define AQ_INTERVAL_MAX_S 21600     /* 6 h */
#define AQ_PM_OFFSET_MAX_X10 500    /* ±50 µg/m³ */
#define AQ_TEMP_OFFSET_MAX_X100 1000 /* ±10 °C */

/* aq_downlink_apply() results. */
#define AQ_DL_OK 0
#define AQ_DL_MALFORMED -1    /* empty, truncated or unknown command */
#define AQ_DL_OUT_OF_RANGE -2 /* well-formed, but the value is outside the range above */

/** Node runtime config, adjustable over the air via downlink commands. */
typedef struct {
    uint16_t sample_interval_s; /* default 300 (5 min) */
    int16_t pm_offset_x10;      /* PM2.5 calibration offset, µg/m³ ×10 */
    int16_t temp_offset_x100;   /* temperature calibration offset, °C ×100 */
} aq_config_t;

/** Reset config to firmware defaults. */
void aq_config_init(aq_config_t *cfg);

/** 1 if every field is inside its accepted range, else 0 (e.g. a corrupt store). */
int aq_config_valid(const aq_config_t *cfg);

/**
 * Parse + apply one downlink command. Returns AQ_DL_OK, or AQ_DL_MALFORMED /
 * AQ_DL_OUT_OF_RANGE, in which case the config is left unchanged.
 */
int aq_downlink_apply(const uint8_t *buf, size_t len, aq_config_t *cfg);

#endif /* AQ_DOWNLINK_H */
