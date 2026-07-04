#include "aq_payload.h" /* AQ_PRESENT_* */
#include "aq_sensors.h"

/**
 * Sample all sensors, continuing past a failed one so a dead PM sensor doesn't
 * also silence temperature/humidity/battery — the diagnostics you need to triage
 * a pole-mounted node. `out->present` records which groups reported. Returns 0 if
 * at least one measurement sensor succeeded (battery is always read), else -1.
 */
int aq_sample(const aq_sensor_hal_t *hal, aq_reading_t *out) {
    out->present = 0;

    if (hal->read_pm(&out->pm25, &out->pm10) == 0) {
        out->present |= AQ_PRESENT_PM;
    } else {
        out->pm25 = 0.0f;
        out->pm10 = 0.0f;
    }

    if (hal->read_env(&out->temperature, &out->humidity, &out->pressure) == 0) {
        out->present |= AQ_PRESENT_ENV;
    } else {
        out->temperature = 0.0f;
        out->humidity = 0.0f;
        out->pressure = 0.0f;
    }

    out->battery_mv = hal->read_battery_mv();

    return (out->present != 0) ? 0 : -1;
}
