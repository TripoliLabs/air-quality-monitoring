#ifndef AQ_CONFIG_H
#define AQ_CONFIG_H

#include <stddef.h>
#include <stdint.h>

#include "aq_downlink.h"
#include "aq_reading.h"

/**
 * Remote configuration on the node: what a wake does, how long the node then
 * sleeps, and the config report that tells the server which settings are active.
 * Portable, so the ESP32 build and the host simulator run the same decisions.
 *
 * A config downlink arrives in the receive window after an uplink. The node
 * applies it straight away (the new interval governs the sleep that follows),
 * then wakes after AQ_REPORT_DELAY_S and sends a config report in place of a
 * reading, so the server sees the result within two uplinks. A cold boot also
 * reports once, after its first reading, so the server learns the settings that
 * were loaded from flash.
 *
 * Config report, sent on fPort AQ_REPORT_FPORT (AQ_REPORT_LEN bytes, LE):
 *   offset  size  field
 *   0       1     report version (AQ_REPORT_VERSION)
 *   1       1     result of the last config downlink (AQ_RESULT_*)
 *   2       1     opcode of the last config downlink (0 = none since boot)
 *   3       2     sample interval, seconds        uint16
 *   5       2     PM2.5 offset, µg/m³ ×10          int16
 *   7       2     temperature offset, °C ×100      int16
 * Mirrored in packages/telemetry-codec; both are checked against the shared
 * vectors in packages/telemetry-codec/vectors/report.csv.
 */
#define AQ_REPORT_FPORT 11
#define AQ_REPORT_LEN 9
#define AQ_REPORT_VERSION 1

/* Gap between the uplink that carried a change (or the first after a cold boot)
 * and the report confirming it. Long enough for the EU868 duty cycle at SF12. */
#define AQ_REPORT_DELAY_S 120

#define AQ_RESULT_NONE 0         /* no config downlink since boot */
#define AQ_RESULT_APPLIED 1
#define AQ_RESULT_OUT_OF_RANGE 2 /* rejected; config unchanged */
#define AQ_RESULT_MALFORMED 3    /* rejected; config unchanged */

/** Config plus the bookkeeping that has to survive deep sleep. */
typedef struct {
    aq_config_t cfg;
    uint8_t report_pending; /* the next wake sends a config report, not a reading */
    uint8_t last_cmd;       /* opcode of the last config downlink, 0 = none */
    uint8_t last_result;    /* AQ_RESULT_* */
} aq_node_state_t;

/** Start from `cfg` (e.g. loaded from flash), or the defaults if it is NULL or
 * out of range. Nothing is pending. */
void aq_state_init(aq_node_state_t *st, const aq_config_t *cfg);

/**
 * Handle a downlink the radio received after an uplink. Only fPort
 * AQ_DOWNLINK_FPORT is config; anything else (e.g. MAC-only frames on fPort 0) is
 * ignored. A config downlink always queues a report, whether it was applied or
 * rejected. Returns 1 if the config changed and should be persisted, else 0.
 */
int aq_state_on_downlink(aq_node_state_t *st, uint8_t fport, const uint8_t *buf, size_t len);

/** Queue a report without a downlink (after the first reading of a cold boot). */
void aq_state_request_report(aq_node_state_t *st);

/** 1 if this wake should send a config report instead of a reading. */
int aq_state_report_due(const aq_node_state_t *st);

/** Call once the report wake's uplink is done, sent or not. A failed report is not
 * retried; the server sees no confirmation and can send the command again. */
void aq_state_report_done(aq_node_state_t *st);

/** Seconds to deep-sleep after this wake. */
uint32_t aq_state_sleep_s(const aq_node_state_t *st);

/** Encode the config report for the current state. */
void aq_config_report_encode(const aq_node_state_t *st, uint8_t out[AQ_REPORT_LEN]);

/** Apply the calibration offsets to the groups `r->present` says were read. */
void aq_config_calibrate(const aq_config_t *cfg, aq_reading_t *r);

#endif /* AQ_CONFIG_H */
