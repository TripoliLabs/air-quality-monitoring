#include <string.h>

#include "../core/aq_config.h"
#include "../core/aq_payload.h"
#include "test_framework.h"

static void test_init_falls_back_to_defaults(void) {
    aq_node_state_t st;
    aq_state_init(&st, NULL);
    TEST_ASSERT_EQUAL_UINT(300, st.cfg.sample_interval_s);
    TEST_ASSERT(!aq_state_report_due(&st));

    aq_config_t corrupt = {.sample_interval_s = 5, .pm_offset_x10 = 0, .temp_offset_x100 = 0};
    aq_state_init(&st, &corrupt);
    TEST_ASSERT_EQUAL_UINT(300, st.cfg.sample_interval_s);

    aq_config_t stored = {.sample_interval_s = 900, .pm_offset_x10 = -20, .temp_offset_x100 = 50};
    aq_state_init(&st, &stored);
    TEST_ASSERT_EQUAL_UINT(900, st.cfg.sample_interval_s);
    TEST_ASSERT(st.cfg.pm_offset_x10 == -20);
}

/* The issue's acceptance path: a new interval takes effect within two uplinks. */
static void test_downlink_then_report_then_new_interval(void) {
    aq_node_state_t st;
    aq_state_init(&st, NULL);

    /* Uplink N (a reading) carries setInterval 600 back in its receive window. */
    uint8_t cmd[] = {AQ_CMD_SET_INTERVAL, 0x58, 0x02};
    TEST_ASSERT_EQUAL_UINT(1, aq_state_on_downlink(&st, AQ_DOWNLINK_FPORT, cmd, sizeof(cmd)));
    TEST_ASSERT_EQUAL_UINT(600, st.cfg.sample_interval_s);
    TEST_ASSERT(aq_state_report_due(&st));
    TEST_ASSERT_EQUAL_UINT(AQ_REPORT_DELAY_S, aq_state_sleep_s(&st));

    /* Uplink N+1 is the report confirming it. */
    uint8_t report[AQ_REPORT_LEN];
    aq_config_report_encode(&st, report);
    const uint8_t expected[AQ_REPORT_LEN] = {AQ_REPORT_VERSION, AQ_RESULT_APPLIED,
                                             AQ_CMD_SET_INTERVAL, 0x58, 0x02, 0, 0, 0, 0};
    TEST_ASSERT(memcmp(report, expected, AQ_REPORT_LEN) == 0);
    aq_state_report_done(&st);

    /* From then on the node sleeps the new interval between readings. */
    TEST_ASSERT(!aq_state_report_due(&st));
    TEST_ASSERT_EQUAL_UINT(600, aq_state_sleep_s(&st));
}

static void test_rejected_downlink_still_reports(void) {
    aq_node_state_t st;
    aq_state_init(&st, NULL);
    uint8_t too_fast[] = {AQ_CMD_SET_INTERVAL, 0x0a, 0x00}; /* 10 s */
    TEST_ASSERT_EQUAL_UINT(0, aq_state_on_downlink(&st, AQ_DOWNLINK_FPORT, too_fast, 3));
    TEST_ASSERT_EQUAL_UINT(300, st.cfg.sample_interval_s);
    TEST_ASSERT(aq_state_report_due(&st));
    TEST_ASSERT_EQUAL_UINT(AQ_RESULT_OUT_OF_RANGE, st.last_result);

    uint8_t unknown[] = {0x7f, 0x00, 0x00};
    TEST_ASSERT_EQUAL_UINT(0, aq_state_on_downlink(&st, AQ_DOWNLINK_FPORT, unknown, 3));
    TEST_ASSERT_EQUAL_UINT(AQ_RESULT_MALFORMED, st.last_result);
    TEST_ASSERT_EQUAL_UINT(0x7f, st.last_cmd);
}

static void test_ignores_other_ports_and_repeats(void) {
    aq_node_state_t st;
    aq_state_init(&st, NULL);
    uint8_t cmd[] = {AQ_CMD_SET_INTERVAL, 0x58, 0x02};
    /* MAC-only downlinks arrive on fPort 0; they are not config. */
    TEST_ASSERT_EQUAL_UINT(0, aq_state_on_downlink(&st, 0, cmd, sizeof(cmd)));
    TEST_ASSERT(!aq_state_report_due(&st));
    TEST_ASSERT_EQUAL_UINT(300, st.cfg.sample_interval_s);

    /* Re-sending the active value is confirmed but needs no flash write. */
    uint8_t same[] = {AQ_CMD_SET_INTERVAL, 0x2c, 0x01}; /* 300 s */
    TEST_ASSERT_EQUAL_UINT(0, aq_state_on_downlink(&st, AQ_DOWNLINK_FPORT, same, 3));
    TEST_ASSERT(aq_state_report_due(&st));
    TEST_ASSERT_EQUAL_UINT(AQ_RESULT_APPLIED, st.last_result);
}

static void test_boot_report(void) {
    aq_node_state_t st;
    aq_state_init(&st, NULL);
    aq_state_request_report(&st);
    TEST_ASSERT(aq_state_report_due(&st));
    uint8_t report[AQ_REPORT_LEN];
    aq_config_report_encode(&st, report);
    TEST_ASSERT_EQUAL_UINT(AQ_RESULT_NONE, report[1]);
    TEST_ASSERT_EQUAL_UINT(0, report[2]);
    TEST_ASSERT_EQUAL_UINT(300, report[3] | (report[4] << 8));
}

static void test_calibrate_only_present_groups(void) {
    aq_config_t cfg = {.sample_interval_s = 300, .pm_offset_x10 = -35, .temp_offset_x100 = 150};
    aq_reading_t r = {.pm25 = 10.0f, .temperature = 20.0f, .present = AQ_PRESENT_PM};
    aq_config_calibrate(&cfg, &r);
    TEST_ASSERT(r.pm25 > 6.49f && r.pm25 < 6.51f);
    TEST_ASSERT(r.temperature == 20.0f); /* env absent: left at the zero-fill value */

    aq_reading_t clean = {.pm25 = 2.0f, .present = AQ_PRESENT_PM};
    aq_config_calibrate(&cfg, &clean);
    TEST_ASSERT(clean.pm25 == 0.0f); /* never negative */

    aq_reading_t env = {.temperature = 20.0f, .present = AQ_PRESENT_ENV};
    aq_config_calibrate(&cfg, &env);
    TEST_ASSERT(env.temperature > 21.49f && env.temperature < 21.51f);
}

int main(void) {
    printf("aq_config tests\n");
    RUN_TEST(test_init_falls_back_to_defaults);
    RUN_TEST(test_downlink_then_report_then_new_interval);
    RUN_TEST(test_rejected_downlink_still_reports);
    RUN_TEST(test_ignores_other_ports_and_repeats);
    RUN_TEST(test_boot_report);
    RUN_TEST(test_calibrate_only_present_groups);
    TEST_SUMMARY();
}
