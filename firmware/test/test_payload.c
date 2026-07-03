#include "../core/aq_payload.h"
#include "test_framework.h"

static uint16_t u16(const uint8_t *b) {
    return (uint16_t)(b[0] | (b[1] << 8));
}

static void test_known_encoding(void) {
    aq_reading_t r = {0};
    r.pm25 = 10.0f; /* → 100 = 0x0064 LE */
    uint8_t buf[AQ_PAYLOAD_LEN];
    aq_payload_encode(&r, buf);
    TEST_ASSERT_EQUAL_UINT(0x64, buf[0]);
    TEST_ASSERT_EQUAL_UINT(0x00, buf[1]);
    TEST_ASSERT_EQUAL_UINT(13, AQ_PAYLOAD_LEN);
    /* byte 12: version (low nibble) + PM|ENV presence (high nibble). */
    TEST_ASSERT_EQUAL_UINT(AQ_PAYLOAD_VERSION | AQ_PRESENT_PM | AQ_PRESENT_ENV, buf[12]);
    TEST_ASSERT_EQUAL_UINT(AQ_PAYLOAD_VERSION, buf[12] & 0x0f);
}

static void test_full_reading_fields(void) {
    aq_reading_t r = {.pm25 = 42.3f,
                      .pm10 = 78.5f,
                      .temperature = 24.55f,
                      .humidity = 61.2f,
                      .pressure = 1013.0f,
                      .battery_mv = 3950};
    uint8_t b[AQ_PAYLOAD_LEN];
    aq_payload_encode(&r, b);
    TEST_ASSERT_EQUAL_UINT(423, u16(&b[0]));   /* pm25 × 10 */
    TEST_ASSERT_EQUAL_UINT(785, u16(&b[2]));   /* pm10 × 10 */
    TEST_ASSERT_EQUAL_UINT(2455, u16(&b[4]));  /* temp × 100 */
    TEST_ASSERT_EQUAL_UINT(6120, u16(&b[6]));  /* humidity × 100 */
    TEST_ASSERT_EQUAL_UINT(1013, u16(&b[8]));  /* pressure */
    TEST_ASSERT_EQUAL_UINT(3950, u16(&b[10])); /* battery */
}

static void test_negative_temperature(void) {
    aq_reading_t r = {0};
    r.temperature = -12.5f; /* → -1250 */
    uint8_t b[AQ_PAYLOAD_LEN];
    aq_payload_encode(&r, b);
    int16_t temp = (int16_t)u16(&b[4]);
    TEST_ASSERT(temp == -1250);
}

int main(void) {
    printf("aq_payload tests\n");
    RUN_TEST(test_known_encoding);
    RUN_TEST(test_full_reading_fields);
    RUN_TEST(test_negative_temperature);
    TEST_SUMMARY();
}
