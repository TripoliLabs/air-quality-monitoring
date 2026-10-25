#include "../core/aq_downlink.h"
#include "test_framework.h"

static void test_defaults(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    TEST_ASSERT_EQUAL_UINT(300, cfg.sample_interval_s);
    TEST_ASSERT(cfg.pm_offset_x10 == 0);
    TEST_ASSERT(cfg.temp_offset_x100 == 0);
}

static void test_set_interval(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    /* SET_INTERVAL, 600s = 0x0258 LE */
    uint8_t cmd[] = {AQ_CMD_SET_INTERVAL, 0x58, 0x02};
    TEST_ASSERT_EQUAL_UINT(0, aq_downlink_apply(cmd, sizeof(cmd), &cfg));
    TEST_ASSERT_EQUAL_UINT(600, cfg.sample_interval_s);
}

static void test_set_negative_offset(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    /* SET_TEMP_OFFSET, -150 (×100 → -1.5°C) = 0xFF6A LE */
    uint8_t cmd[] = {AQ_CMD_SET_TEMP_OFFSET, 0x6a, 0xff};
    TEST_ASSERT_EQUAL_UINT(0, aq_downlink_apply(cmd, sizeof(cmd), &cfg));
    TEST_ASSERT(cfg.temp_offset_x100 == -150);
}

static void test_rejects_unknown_and_short(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    uint8_t unknown[] = {0x7f, 0x00, 0x00};
    TEST_ASSERT(aq_downlink_apply(unknown, sizeof(unknown), &cfg) == AQ_DL_MALFORMED);
    uint8_t truncated[] = {AQ_CMD_SET_INTERVAL, 0x58}; /* missing a byte */
    TEST_ASSERT(aq_downlink_apply(truncated, sizeof(truncated), &cfg) == AQ_DL_MALFORMED);
    TEST_ASSERT(aq_downlink_apply(NULL, 0, &cfg) == AQ_DL_MALFORMED);
    /* config unchanged after all rejects */
    TEST_ASSERT_EQUAL_UINT(300, cfg.sample_interval_s);
}

static void test_rejects_out_of_range(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    uint8_t too_fast[] = {AQ_CMD_SET_INTERVAL, 0x77, 0x00}; /* 119 s, one under the floor */
    TEST_ASSERT(aq_downlink_apply(too_fast, sizeof(too_fast), &cfg) == AQ_DL_OUT_OF_RANGE);
    uint8_t zero[] = {AQ_CMD_SET_INTERVAL, 0x00, 0x00}; /* would mean "never sleep" */
    TEST_ASSERT(aq_downlink_apply(zero, sizeof(zero), &cfg) == AQ_DL_OUT_OF_RANGE);
    uint8_t too_slow[] = {AQ_CMD_SET_INTERVAL, 0x61, 0x54}; /* 21601 s */
    TEST_ASSERT(aq_downlink_apply(too_slow, sizeof(too_slow), &cfg) == AQ_DL_OUT_OF_RANGE);
    uint8_t pm_big[] = {AQ_CMD_SET_PM_OFFSET, 0xf5, 0x01}; /* +50.1 µg/m³ */
    TEST_ASSERT(aq_downlink_apply(pm_big, sizeof(pm_big), &cfg) == AQ_DL_OUT_OF_RANGE);
    uint8_t temp_low[] = {AQ_CMD_SET_TEMP_OFFSET, 0x17, 0xfc}; /* -10.01 °C */
    TEST_ASSERT(aq_downlink_apply(temp_low, sizeof(temp_low), &cfg) == AQ_DL_OUT_OF_RANGE);
    /* config unchanged after all rejects */
    TEST_ASSERT_EQUAL_UINT(300, cfg.sample_interval_s);
    TEST_ASSERT(cfg.pm_offset_x10 == 0);
    TEST_ASSERT(cfg.temp_offset_x100 == 0);
}

static void test_accepts_range_limits(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    uint8_t floor_[] = {AQ_CMD_SET_INTERVAL, 0x78, 0x00}; /* 120 s */
    TEST_ASSERT(aq_downlink_apply(floor_, sizeof(floor_), &cfg) == AQ_DL_OK);
    TEST_ASSERT_EQUAL_UINT(AQ_INTERVAL_MIN_S, cfg.sample_interval_s);
    uint8_t ceiling[] = {AQ_CMD_SET_INTERVAL, 0x60, 0x54}; /* 21600 s */
    TEST_ASSERT(aq_downlink_apply(ceiling, sizeof(ceiling), &cfg) == AQ_DL_OK);
    TEST_ASSERT_EQUAL_UINT(AQ_INTERVAL_MAX_S, cfg.sample_interval_s);
    uint8_t pm_min[] = {AQ_CMD_SET_PM_OFFSET, 0x0c, 0xfe}; /* -50.0 µg/m³ */
    TEST_ASSERT(aq_downlink_apply(pm_min, sizeof(pm_min), &cfg) == AQ_DL_OK);
    TEST_ASSERT(cfg.pm_offset_x10 == -AQ_PM_OFFSET_MAX_X10);
}

static void test_config_valid(void) {
    aq_config_t cfg;
    aq_config_init(&cfg);
    TEST_ASSERT(aq_config_valid(&cfg)); /* the defaults are always accepted */
    cfg.sample_interval_s = 0;
    TEST_ASSERT(!aq_config_valid(&cfg));
}

int main(void) {
    printf("aq_downlink tests\n");
    RUN_TEST(test_defaults);
    RUN_TEST(test_set_interval);
    RUN_TEST(test_set_negative_offset);
    RUN_TEST(test_rejects_unknown_and_short);
    RUN_TEST(test_rejects_out_of_range);
    RUN_TEST(test_accepts_range_limits);
    RUN_TEST(test_config_valid);
    TEST_SUMMARY();
}
