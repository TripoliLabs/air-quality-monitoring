#ifndef AQ_SENSORS_H
#define AQ_SENSORS_H

#include <stdint.h>
#include "aq_reading.h"

/**
 * Sensor Hardware Abstraction Layer. The portable node logic samples through
 * this interface; platforms supply the implementations:
 *   - esp32 adapter → real PMS7003 (UART) + BME280 (I2C) drivers
 *   - host  adapter → simulated drivers (for off-target runs and tests)
 */
typedef struct {
    int (*read_pm)(float *pm25, float *pm10);                       /* 0 on success */
    int (*read_env)(float *temp_c, float *humidity, float *pressure_hpa);
    uint16_t (*read_battery_mv)(void);
} aq_sensor_hal_t;

/** Sample all sensors into `out` via `hal`. Returns 0 on success, <0 on error. */
int aq_sample(const aq_sensor_hal_t *hal, aq_reading_t *out);

#endif /* AQ_SENSORS_H */
