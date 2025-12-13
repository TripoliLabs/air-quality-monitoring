/**
 * BME280 Environmental Sensor Driver
 * Bosch BME280 - Measures Temperature, Humidity, Pressure
 *
 * Communication: I2C (address 0x76 or 0x77)
 */

#ifndef BME280_H
#define BME280_H

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * BME280 reading data structure
 */
typedef struct {
    float temperature;  // Temperature in Celsius
    float humidity;     // Relative humidity in %
    float pressure;     // Pressure in hPa (hectopascals)
} bme280_data_t;

/**
 * Initialize BME280 sensor
 * @param i2c_num I2C port number
 * @param sda_pin SDA GPIO pin
 * @param scl_pin SCL GPIO pin
 * @param i2c_addr I2C address (0x76 or 0x77)
 * @return ESP_OK on success
 */
esp_err_t bme280_init(int i2c_num, int sda_pin, int scl_pin, uint8_t i2c_addr);

/**
 * Read data from BME280 sensor
 * @param data Pointer to data structure to fill
 * @return ESP_OK on success
 */
esp_err_t bme280_read(bme280_data_t *data);

/**
 * Put sensor into sleep mode (low power)
 * @return ESP_OK on success
 */
esp_err_t bme280_sleep(void);

/**
 * Wake sensor and set to forced mode
 * @return ESP_OK on success
 */
esp_err_t bme280_wake(void);

/**
 * Deinitialize BME280 and free resources
 */
void bme280_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // BME280_H
