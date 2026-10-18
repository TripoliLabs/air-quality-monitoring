/**
 * Host entrypoint for the node firmware.
 *
 * Runs the real `aq_sample()` + `aq_payload_encode()` logic against the
 * simulated sensor adapter and prints the base64-encoded uplink — exactly the
 * bytes the ESP32 would transmit. The traffic simulator spawns this per node per
 * uplink, so the data genuinely originates from the firmware. (The LoRa RF hop
 * itself is the hardware boundary and is injected at the ChirpStack uplink layer
 * by the simulator.)
 *
 * One wake, without remote config (prints the base64 reading):
 *   aq-node-sim --baseline-pm25 <f> --hour <f> --fcnt <n> --seed <n>
 *
 * One wake with remote config, as src/main.cpp runs it on the board. The state
 * file stands in for RTC RAM and NVS; a missing file is a first boot. --boot
 * marks a power cycle: RTC RAM is lost, so only the stored config survives.
 * Prints "<fport> <base64 payload> <sleep seconds>":
 *   aq-node-sim --state <file> [--boot] --baseline-pm25 <f> --hour <f> --fcnt <n> --seed <n>
 *
 * Deliver a downlink that arrived after the last uplink. Prints
 * "<result> <interval> <pm offset x10> <temp offset x100> <sleep seconds>"
 * (result: AQ_RESULT_*); on the board that wake would now sleep that long:
 *   aq-node-sim --state <file> --downlink <hex> --fport <n>
 */
#include "../core/aq_config.h"
#include "../core/aq_payload.h"
#include "../core/aq_sensors.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void sim_configure(float baseline_pm25, float hour, uint32_t fcnt);
const aq_sensor_hal_t *sim_hal(void);

static const char B64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void base64_encode(const uint8_t *in, size_t len, char *out) {
    size_t i, o = 0;
    for (i = 0; i + 2 < len; i += 3) {
        uint32_t n = ((uint32_t)in[i] << 16) | ((uint32_t)in[i + 1] << 8) | in[i + 2];
        out[o++] = B64[(n >> 18) & 0x3f];
        out[o++] = B64[(n >> 12) & 0x3f];
        out[o++] = B64[(n >> 6) & 0x3f];
        out[o++] = B64[n & 0x3f];
    }
    if (i < len) {
        uint32_t n = (uint32_t)in[i] << 16;
        if (i + 1 < len) n |= (uint32_t)in[i + 1] << 8;
        out[o++] = B64[(n >> 18) & 0x3f];
        out[o++] = B64[(n >> 12) & 0x3f];
        out[o++] = (i + 1 < len) ? B64[(n >> 6) & 0x3f] : '=';
        out[o++] = '=';
    }
    out[o] = '\0';
}

/* State file: one line, "<interval> <pm> <temp> <pending> <last_cmd> <last_result>".
 * Returns 0 if loaded, -1 for a cold boot (no file, or one that does not parse). */
static int load_state(const char *path, aq_node_state_t *st) {
    FILE *f = fopen(path, "r");
    if (f == NULL) return -1;
    unsigned interval, pending, cmd, result;
    int pm, temp;
    int n = fscanf(f, "%u %d %d %u %u %u", &interval, &pm, &temp, &pending, &cmd, &result);
    fclose(f);
    if (n != 6) return -1;
    aq_config_t cfg = {.sample_interval_s = (uint16_t)interval,
                       .pm_offset_x10 = (int16_t)pm,
                       .temp_offset_x100 = (int16_t)temp};
    aq_state_init(st, &cfg); /* range-checks, like a load from NVS */
    st->report_pending = (uint8_t)pending;
    st->last_cmd = (uint8_t)cmd;
    st->last_result = (uint8_t)result;
    return 0;
}

static int save_state(const char *path, const aq_node_state_t *st) {
    FILE *f = fopen(path, "w");
    if (f == NULL) return -1;
    fprintf(f, "%u %d %d %u %u %u\n", st->cfg.sample_interval_s, st->cfg.pm_offset_x10,
            st->cfg.temp_offset_x100, st->report_pending, st->last_cmd, st->last_result);
    return fclose(f) == 0 ? 0 : -1;
}

static int parse_hex(const char *hex, uint8_t *out, size_t max) {
    size_t len = strlen(hex);
    if (len % 2 != 0 || len / 2 > max) return -1;
    for (size_t i = 0; i < len / 2; i++) {
        unsigned int byte;
        if (sscanf(&hex[i * 2], "%2x", &byte) != 1) return -1;
        out[i] = (uint8_t)byte;
    }
    return (int)(len / 2);
}

static int deliver_downlink(const char *state_path, const char *hex, uint8_t fport) {
    aq_node_state_t st;
    if (load_state(state_path, &st) != 0) aq_state_init(&st, NULL);
    uint8_t buf[242];
    int len = parse_hex(hex, buf, sizeof(buf));
    if (len < 0) {
        fprintf(stderr, "malformed --downlink hex\n");
        return 1;
    }
    aq_state_on_downlink(&st, fport, buf, (size_t)len);
    if (save_state(state_path, &st) != 0) {
        fprintf(stderr, "cannot write %s\n", state_path);
        return 1;
    }
    printf("%u %u %d %d %u\n", st.last_result, st.cfg.sample_interval_s, st.cfg.pm_offset_x10,
           st.cfg.temp_offset_x100, (unsigned)aq_state_sleep_s(&st));
    return 0;
}

int main(int argc, char **argv) {
    float baseline = 30.0f, hour = 12.0f;
    uint32_t fcnt = 0, seed = 1;
    const char *state_path = NULL, *downlink = NULL;
    uint8_t fport = AQ_DOWNLINK_FPORT;
    int boot = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--boot") == 0) {
            boot = 1;
            /* the only flag without a value: drop it so the pairs below line up */
            for (int j = i; j + 1 < argc; j++) argv[j] = argv[j + 1];
            argc--;
            break;
        }
    }
    for (int i = 1; i + 1 < argc; i += 2) {
        if (strcmp(argv[i], "--baseline-pm25") == 0) baseline = (float)atof(argv[i + 1]);
        else if (strcmp(argv[i], "--hour") == 0) hour = (float)atof(argv[i + 1]);
        else if (strcmp(argv[i], "--fcnt") == 0) fcnt = (uint32_t)strtoul(argv[i + 1], NULL, 10);
        else if (strcmp(argv[i], "--seed") == 0) seed = (uint32_t)strtoul(argv[i + 1], NULL, 10);
        else if (strcmp(argv[i], "--state") == 0) state_path = argv[i + 1];
        else if (strcmp(argv[i], "--downlink") == 0) downlink = argv[i + 1];
        else if (strcmp(argv[i], "--fport") == 0) fport = (uint8_t)strtoul(argv[i + 1], NULL, 10);
    }

    if (downlink != NULL) {
        if (state_path == NULL) {
            fprintf(stderr, "--downlink needs --state\n");
            return 1;
        }
        return deliver_downlink(state_path, downlink, fport);
    }

    aq_node_state_t st;
    int cold_boot = 1;
    if (state_path != NULL) {
        cold_boot = load_state(state_path, &st) != 0;
        if (cold_boot) {
            aq_state_init(&st, NULL);
        } else if (boot) {
            /* Power cycle: keep the stored config (NVS), lose the rest (RTC RAM). */
            const aq_config_t stored = st.cfg;
            aq_state_init(&st, &stored);
            cold_boot = 1;
        }
    } else {
        aq_state_init(&st, NULL);
    }

    /* The same choice src/main.cpp makes: a pending report replaces the reading. */
    uint8_t payload[AQ_PAYLOAD_LEN > AQ_REPORT_LEN ? AQ_PAYLOAD_LEN : AQ_REPORT_LEN];
    size_t len;
    uint8_t up_port;
    if (state_path != NULL && aq_state_report_due(&st)) {
        aq_config_report_encode(&st, payload);
        aq_state_report_done(&st);
        len = AQ_REPORT_LEN;
        up_port = AQ_REPORT_FPORT;
    } else {
        srand(seed);
        sim_configure(baseline, hour, fcnt);
        aq_reading_t reading;
        aq_sample(sim_hal(), &reading); /* sends a heartbeat even if every sensor failed */
        aq_config_calibrate(&st.cfg, &reading);
        aq_payload_encode(&reading, payload);
        len = AQ_PAYLOAD_LEN;
        up_port = AQ_DATA_FPORT;
        if (cold_boot) aq_state_request_report(&st);
    }

    char b64[32];
    base64_encode(payload, len, b64);
    if (state_path == NULL) {
        printf("%s\n", b64);
        return 0;
    }
    if (save_state(state_path, &st) != 0) {
        fprintf(stderr, "cannot write %s\n", state_path);
        return 1;
    }
    printf("%u %s %u\n", up_port, b64, (unsigned)aq_state_sleep_s(&st));
    return 0;
}
