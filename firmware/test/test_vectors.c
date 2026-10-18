/* Runs the firmware codec against the test vectors shared with the server codec
 * (packages/telemetry-codec/vectors). The TypeScript suite reads the same files,
 * so the two sides cannot drift apart without one of them failing. */
#include <stdlib.h>
#include <string.h>

#include "../core/aq_config.h"
#include "../core/aq_downlink.h"
#include "../core/aq_payload.h"
#include "test_framework.h"

#define DEFAULT_VECTOR_DIR "../packages/telemetry-codec/vectors"
#define MAX_LINE 512
#define MAX_FIELDS 20
#define UPLINK_FIELDS 18
#define DOWNLINK_FIELDS 5
#define REPORT_FIELDS 7

static const char *vector_dir = DEFAULT_VECTOR_DIR;

/* Split a CSV line in place. The vector files never quote or leave a field
 * empty, so a plain comma split is enough. Returns the field count. */
static int split_fields(char *line, char *fields[MAX_FIELDS]) {
    int n = 0;
    line[strcspn(line, "\r\n")] = '\0';
    for (char *tok = strtok(line, ","); tok != NULL && n < MAX_FIELDS; tok = strtok(NULL, ",")) {
        fields[n++] = tok;
    }
    return n;
}

/* Comment lines, blank lines and the header row carry no vector. */
static int is_vector_line(const char *line) {
    return line[0] != '#' && line[0] != '\r' && line[0] != '\n' && line[0] != '\0' &&
           strncmp(line, "name,", 5) != 0;
}

static FILE *open_vectors(const char *file) {
    char path[MAX_LINE];
    snprintf(path, sizeof(path), "%s/%s", vector_dir, file);
    FILE *f = fopen(path, "r");
    if (f == NULL) {
        printf("  FAIL cannot open %s\n", path);
        tf_failed++;
    }
    return f;
}

/* Parse a hex string into bytes. Returns the byte count, or -1 if malformed. */
static int parse_hex(const char *hex, uint8_t *out, size_t max) {
    size_t len = strlen(hex);
    if (len % 2 != 0 || len / 2 > max) {
        return -1;
    }
    for (size_t i = 0; i < len / 2; i++) {
        unsigned int byte;
        if (sscanf(&hex[i * 2], "%2x", &byte) != 1) {
            return -1;
        }
        out[i] = (uint8_t)byte;
    }
    return (int)(len / 2);
}

static void fail_vector(const char *file, const char *name, const char *why) {
    tf_assertions++;
    tf_failed++;
    printf("  FAIL %s [%s]: %s\n", file, name, why);
}

static void test_uplink_vectors(void) {
    FILE *f = open_vectors("uplink.csv");
    if (f == NULL) return;

    char line[MAX_LINE];
    int checked = 0;
    while (fgets(line, sizeof(line), f) != NULL) {
        if (!is_vector_line(line)) continue;
        char *col[MAX_FIELDS];
        if (split_fields(line, col) != UPLINK_FIELDS) {
            fail_vector("uplink.csv", col[0], "wrong number of columns");
            continue;
        }
        if (strcmp(col[1], "-") == 0) continue; /* decode-only row */

        aq_reading_t r = {.pm25 = strtof(col[1], NULL),
                          .pm10 = strtof(col[2], NULL),
                          .temperature = strtof(col[3], NULL),
                          .humidity = strtof(col[4], NULL),
                          .pressure = strtof(col[5], NULL),
                          .battery_mv = (uint16_t)strtoul(col[6], NULL, 0),
                          .present = (uint8_t)strtoul(col[7], NULL, 0)};
        uint8_t expected[AQ_PAYLOAD_LEN];
        if (parse_hex(col[8], expected, sizeof(expected)) != AQ_PAYLOAD_LEN) {
            fail_vector("uplink.csv", col[0], "hex is not AQ_PAYLOAD_LEN bytes");
            continue;
        }

        uint8_t actual[AQ_PAYLOAD_LEN];
        aq_payload_encode(&r, actual);
        tf_assertions++;
        if (memcmp(expected, actual, AQ_PAYLOAD_LEN) != 0) {
            tf_failed++;
            printf("  FAIL uplink.csv [%s]: expected %s, got ", col[0], col[8]);
            for (int i = 0; i < AQ_PAYLOAD_LEN; i++) printf("%02x", actual[i]);
            printf("\n");
        }
        checked++;
    }
    fclose(f);
    TEST_ASSERT(checked > 0); /* an empty or unreadable file must not pass */
}

static void test_downlink_vectors(void) {
    FILE *f = open_vectors("downlink.csv");
    if (f == NULL) return;

    char line[MAX_LINE];
    int checked = 0;
    while (fgets(line, sizeof(line), f) != NULL) {
        if (!is_vector_line(line)) continue;
        char *col[MAX_FIELDS];
        if (split_fields(line, col) != DOWNLINK_FIELDS) {
            fail_vector("downlink.csv", col[0], "wrong number of columns");
            continue;
        }
        long value = strtol(col[2], NULL, 10);
        uint8_t bytes[8];
        int len = parse_hex(col[3], bytes, sizeof(bytes));
        if (len < 0) {
            fail_vector("downlink.csv", col[0], "malformed hex");
            continue;
        }

        int applied = strcmp(col[4], "applied") == 0;
        if (!applied && strcmp(col[4], "out_of_range") != 0) {
            fail_vector("downlink.csv", col[0], "result is neither applied nor out_of_range");
            continue;
        }

        /* Start from the defaults and move the one field the command targets
         * (none for a rejected command); comparing the whole config also proves
         * nothing else was touched. */
        aq_config_t expected;
        aq_config_init(&expected);
        if (!applied) {
            /* expected stays at the defaults */
        } else if (strcmp(col[1], "setInterval") == 0) {
            expected.sample_interval_s = (uint16_t)value;
        } else if (strcmp(col[1], "setPmOffset") == 0) {
            expected.pm_offset_x10 = (int16_t)value;
        } else if (strcmp(col[1], "setTempOffset") == 0) {
            expected.temp_offset_x100 = (int16_t)value;
        } else {
            fail_vector("downlink.csv", col[0], "command the firmware does not know");
            continue;
        }
        const int expected_rc = applied ? AQ_DL_OK : AQ_DL_OUT_OF_RANGE;

        aq_config_t actual;
        aq_config_init(&actual);
        int rc = aq_downlink_apply(bytes, (size_t)len, &actual);
        tf_assertions++;
        if (rc != expected_rc || actual.sample_interval_s != expected.sample_interval_s ||
            actual.pm_offset_x10 != expected.pm_offset_x10 ||
            actual.temp_offset_x100 != expected.temp_offset_x100) {
            tf_failed++;
            printf("  FAIL downlink.csv [%s]: rc=%d interval=%u pm_offset=%d temp_offset=%d\n",
                   col[0], rc, actual.sample_interval_s, actual.pm_offset_x10,
                   actual.temp_offset_x100);
        }
        checked++;
    }
    fclose(f);
    TEST_ASSERT(checked > 0);
}

static void test_report_vectors(void) {
    FILE *f = open_vectors("report.csv");
    if (f == NULL) return;

    char line[MAX_LINE];
    int checked = 0;
    while (fgets(line, sizeof(line), f) != NULL) {
        if (!is_vector_line(line)) continue;
        char *col[MAX_FIELDS];
        if (split_fields(line, col) != REPORT_FIELDS) {
            fail_vector("report.csv", col[0], "wrong number of columns");
            continue;
        }
        uint8_t expected[AQ_REPORT_LEN];
        if (parse_hex(col[6], expected, sizeof(expected)) != AQ_REPORT_LEN) {
            fail_vector("report.csv", col[0], "hex is not AQ_REPORT_LEN bytes");
            continue;
        }

        aq_node_state_t st = {
            .cfg = {.sample_interval_s = (uint16_t)strtoul(col[3], NULL, 10),
                    .pm_offset_x10 = (int16_t)strtol(col[4], NULL, 10),
                    .temp_offset_x100 = (int16_t)strtol(col[5], NULL, 10)},
            .report_pending = 1,
            .last_cmd = (uint8_t)strtoul(col[2], NULL, 10),
            .last_result = (uint8_t)strtoul(col[1], NULL, 10),
        };
        uint8_t actual[AQ_REPORT_LEN];
        aq_config_report_encode(&st, actual);
        tf_assertions++;
        if (memcmp(expected, actual, AQ_REPORT_LEN) != 0) {
            tf_failed++;
            printf("  FAIL report.csv [%s]: expected %s, got ", col[0], col[6]);
            for (int i = 0; i < AQ_REPORT_LEN; i++) printf("%02x", actual[i]);
            printf("\n");
        }
        checked++;
    }
    fclose(f);
    TEST_ASSERT(checked > 0);
}

int main(int argc, char **argv) {
    if (argc > 1) {
        vector_dir = argv[1];
    }
    printf("shared codec vector tests (%s)\n", vector_dir);
    RUN_TEST(test_uplink_vectors);
    RUN_TEST(test_downlink_vectors);
    RUN_TEST(test_report_vectors);
    TEST_SUMMARY();
}
