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

/** Node runtime config, adjustable over the air via downlink commands. */
typedef struct {
    uint16_t sample_interval_s; /* default 300 (5 min) */
    int16_t pm_offset_x10;      /* PM2.5 calibration offset, µg/m³ ×10 */
    int16_t temp_offset_x100;   /* temperature calibration offset, °C ×100 */
} aq_config_t;

/** Reset config to firmware defaults. */
void aq_config_init(aq_config_t *cfg);

/**
 * Parse + apply one downlink command. Returns 0 on success, or -1 for a
 * malformed or unknown command (config is left unchanged in that case).
 */
int aq_downlink_apply(const uint8_t *buf, size_t len, aq_config_t *cfg);

#endif /* AQ_DOWNLINK_H */
