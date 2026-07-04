#include "../core/aq_payload.h" /* AQ_PRESENT_* */
#include "../core/aq_sensors.h"
#include "test_framework.h"

static int pm_ok(float *a, float *b) {
    *a = 12.3f;
    *b = 20.0f;
    return 0;
}
static int pm_fail(float *a, float *b) {
    (void)a;
    (void)b;
    return -1;
}
static int env_ok(float *t, float *h, float *p) {
    *t = 25.0f;
    *h = 50.0f;
    *p = 1010.0f;
    return 0;
}
static int env_fail(float *t, float *h, float *p) {
    (void)t;
    (void)h;
    (void)p;
    return -1;
}
static uint16_t batt(void) {
    return 3900;
}

static void test_all_ok(void) {
    aq_sensor_hal_t hal = {pm_ok, env_ok, batt};
    aq_reading_t r;
    TEST_ASSERT_EQUAL_UINT(0, aq_sample(&hal, &r));
    TEST_ASSERT_EQUAL_UINT(AQ_PRESENT_PM | AQ_PRESENT_ENV, r.present);
    TEST_ASSERT_EQUAL_UINT(3900, r.battery_mv);
}

static void test_pm_fails_env_survives(void) {
    aq_sensor_hal_t hal = {pm_fail, env_ok, batt};
    aq_reading_t r;
    /* returns 0 — env + battery diagnostics still reported despite a dead PM sensor */
    TEST_ASSERT_EQUAL_UINT(0, aq_sample(&hal, &r));
    TEST_ASSERT_EQUAL_UINT(AQ_PRESENT_ENV, r.present);
    TEST_ASSERT(r.pm25 == 0.0f);
    TEST_ASSERT_EQUAL_UINT(3900, r.battery_mv);
}

static void test_all_sensors_fail(void) {
    aq_sensor_hal_t hal = {pm_fail, env_fail, batt};
    aq_reading_t r;
    TEST_ASSERT(aq_sample(&hal, &r) == -1);
    TEST_ASSERT_EQUAL_UINT(0, r.present);
}

int main(void) {
    printf("aq_sample tests\n");
    RUN_TEST(test_all_ok);
    RUN_TEST(test_pm_fails_env_survives);
    RUN_TEST(test_all_sensors_fail);
    TEST_SUMMARY();
}
