/**
 * ESP32 sensor HAL adapter (on-target). Implements the firmware/core sensor
 * interface against the real hardware:
 *   - PMS7003 particulate sensor over UART
 *   - BME280 temp/humidity/pressure over I2C
 *   - battery voltage via ADC divider
 *
 * Driver bring-up is TODO; signatures are fixed by core/aq_sensors.h.
 */
#include <stdint.h>

int esp32_read_pm(float *pm25, float *pm10) {
    /* TODO: read a PMS7003 frame over UART (9600 baud, 32-byte frame). */
    (void)pm25;
    (void)pm10;
    return -1;
}

int esp32_read_env(float *temp_c, float *humidity, float *pressure_hpa) {
    /* TODO: read BME280 over I2C and apply compensation. */
    (void)temp_c;
    (void)humidity;
    (void)pressure_hpa;
    return -1;
}

uint16_t esp32_read_battery_mv(void) {
    /* TODO: sample the battery ADC channel and scale by the divider. */
    return 0;
}
