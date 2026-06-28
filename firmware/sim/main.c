/**
 * Host entrypoint for the node firmware.
 *
 * Runs the real `aq_sample()` + `aq_payload_encode()` logic against the
 * simulated sensor adapter and prints the base64-encoded 13-byte uplink
 * payload to stdout — exactly the bytes the ESP32 would transmit. The traffic
 * simulator spawns this per node per uplink, so the data genuinely originates
 * from the firmware. (The LoRa RF hop itself is the hardware boundary and is
 * injected at the ChirpStack uplink layer by the simulator.)
 *
 *   aq-node-sim --baseline-pm25 <f> --hour <f> --fcnt <n> --seed <n>
 */
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

int main(int argc, char **argv) {
    float baseline = 30.0f, hour = 12.0f;
    uint32_t fcnt = 0, seed = 1;
    for (int i = 1; i + 1 < argc; i += 2) {
        if (strcmp(argv[i], "--baseline-pm25") == 0) baseline = (float)atof(argv[i + 1]);
        else if (strcmp(argv[i], "--hour") == 0) hour = (float)atof(argv[i + 1]);
        else if (strcmp(argv[i], "--fcnt") == 0) fcnt = (uint32_t)strtoul(argv[i + 1], NULL, 10);
        else if (strcmp(argv[i], "--seed") == 0) seed = (uint32_t)strtoul(argv[i + 1], NULL, 10);
    }

    srand(seed);
    sim_configure(baseline, hour, fcnt);

    aq_reading_t reading;
    if (aq_sample(sim_hal(), &reading) != 0) {
        fprintf(stderr, "sensor sample failed\n");
        return 1;
    }

    uint8_t payload[AQ_PAYLOAD_LEN];
    aq_payload_encode(&reading, payload);

    char b64[32];
    base64_encode(payload, AQ_PAYLOAD_LEN, b64);
    printf("%s\n", b64);
    return 0;
}
