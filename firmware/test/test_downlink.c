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
    TEST_ASSERT(aq_downlink_apply(unknown, sizeof(unknown), &cfg) == -1);
    uint8_t truncated[] = {AQ_CMD_SET_INTERVAL, 0x58}; /* missing a byte */
    TEST_ASSERT(aq_downlink_apply(truncated, sizeof(truncated), &cfg) == -1);
    TEST_ASSERT(aq_downlink_apply(NULL, 0, &cfg) == -1);
    /* config unchanged after all rejects */
    TEST_ASSERT_EQUAL_UINT(300, cfg.sample_interval_s);
}

int main(void) {
    printf("aq_downlink tests\n");
    RUN_TEST(test_defaults);
    RUN_TEST(test_set_interval);
    RUN_TEST(test_set_negative_offset);
    RUN_TEST(test_rejects_unknown_and_short);
    TEST_SUMMARY();
}
