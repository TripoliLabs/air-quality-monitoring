#include "aq_sensors.h"

int aq_sample(const aq_sensor_hal_t *hal, aq_reading_t *out) {
    if (hal->read_pm(&out->pm25, &out->pm10) != 0) {
        return -1;
    }
    if (hal->read_env(&out->temperature, &out->humidity, &out->pressure) != 0) {
        return -2;
    }
    out->battery_mv = hal->read_battery_mv();
    return 0;
}
