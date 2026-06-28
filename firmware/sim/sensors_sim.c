/**
 * Host (off-target) sensor adapter — simulated PMS7003 + BME280 + battery.
 *
 * Models the DOCUMENTED hardware behaviour (PMS7003 particulate sensor,
 * BME280 temp/humidity/pressure) so the real firmware `aq_sample()` logic can
 * run unchanged on the host, producing the same payloads the device would.
 * Configure with sim_configure() before each sample.
 */
#include "../core/aq_sensors.h"
#include <math.h>
#include <stdlib.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static float s_baseline_pm25 = 30.0f;
static float s_hour = 12.0f;
static uint32_t s_fcnt = 0;

void sim_configure(float baseline_pm25, float hour, uint32_t fcnt) {
    s_baseline_pm25 = baseline_pm25;
    s_hour = hour;
    s_fcnt = fcnt;
}

/* Uniform noise in [-mag, +mag]. */
static float noise(float mag) {
    return ((float)rand() / (float)RAND_MAX) * 2.0f * mag - mag;
}

/* Pollution peaks at the morning (~8h) and evening (~19h) rush. */
static float diurnal_factor(float hour) {
    float morning = expf(-((hour - 8.0f) * (hour - 8.0f)) / 6.0f);
    float evening = expf(-((hour - 19.0f) * (hour - 19.0f)) / 8.0f);
    float peak = morning > evening ? morning : evening;
    return 0.6f + 0.9f * peak;
}

static int sim_read_pm(float *pm25, float *pm10) {
    float v = s_baseline_pm25 * diurnal_factor(s_hour) + noise(6.0f);
    if (v < 2.0f) v = 2.0f;
    *pm25 = v;
    *pm10 = v * (1.4f + noise(0.2f)) + noise(4.0f);
    if (*pm10 < *pm25) *pm10 = *pm25;
    return 0;
}

static int sim_read_env(float *temp_c, float *humidity, float *pressure_hpa) {
    float t = 22.0f + 7.0f * sinf(((s_hour - 9.0f) / 24.0f) * 2.0f * (float)M_PI) + noise(1.5f);
    float h = 70.0f - (t - 22.0f) * 2.0f + noise(5.0f);
    if (h < 25.0f) h = 25.0f;
    if (h > 95.0f) h = 95.0f;
    *temp_c = t;
    *humidity = h;
    *pressure_hpa = 1013.0f + noise(6.0f);
    return 0;
}

static uint16_t sim_read_battery_mv(void) {
    /* Slow linear drain from ~4100 mV, clamped at 3300 mV. */
    int mv = 4100 - (int)(s_fcnt * 1);
    if (mv < 3300) mv = 3300;
    return (uint16_t)mv;
}

static const aq_sensor_hal_t s_sim_hal = {
    .read_pm = sim_read_pm,
    .read_env = sim_read_env,
    .read_battery_mv = sim_read_battery_mv,
};

const aq_sensor_hal_t *sim_hal(void) {
    return &s_sim_hal;
}
