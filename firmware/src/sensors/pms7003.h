/**
 * PMS7003 Particulate Matter Sensor Driver
 * Plantower PMS7003 - Measures PM1.0, PM2.5, PM10
 *
 * Communication: UART (9600 baud)
 * Protocol: 32-byte data frame
 */

#ifndef PMS7003_H
#define PMS7003_H

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * PMS7003 reading data structure
 */
typedef struct {
    uint16_t pm1_0_standard;   // PM1.0 concentration (CF=1, standard particle)
    uint16_t pm2_5_standard;   // PM2.5 concentration (CF=1, standard particle)
    uint16_t pm10_standard;    // PM10 concentration (CF=1, standard particle)
    uint16_t pm1_0_env;        // PM1.0 concentration (atmospheric environment)
    uint16_t pm2_5_env;        // PM2.5 concentration (atmospheric environment)
    uint16_t pm10_env;         // PM10 concentration (atmospheric environment)
    uint16_t particles_03um;   // Particles > 0.3um in 0.1L of air
    uint16_t particles_05um;   // Particles > 0.5um in 0.1L of air
    uint16_t particles_10um;   // Particles > 1.0um in 0.1L of air
    uint16_t particles_25um;   // Particles > 2.5um in 0.1L of air
    uint16_t particles_50um;   // Particles > 5.0um in 0.1L of air
    uint16_t particles_100um;  // Particles > 10.0um in 0.1L of air
} pms7003_data_t;

/**
 * Initialize PMS7003 sensor
 * @param uart_num UART port number
 * @param tx_pin TX GPIO pin
 * @param rx_pin RX GPIO pin
 * @return ESP_OK on success
 */
esp_err_t pms7003_init(int uart_num, int tx_pin, int rx_pin);

/**
 * Read data from PMS7003 sensor
 * @param data Pointer to data structure to fill
 * @param timeout_ms Read timeout in milliseconds
 * @return ESP_OK on success, ESP_ERR_TIMEOUT if no data received
 */
esp_err_t pms7003_read(pms7003_data_t *data, uint32_t timeout_ms);

/**
 * Put sensor into sleep mode (low power)
 * @return ESP_OK on success
 */
esp_err_t pms7003_sleep(void);

/**
 * Wake sensor from sleep mode
 * Note: Sensor needs ~30s warm-up time after wake
 * @return ESP_OK on success
 */
esp_err_t pms7003_wake(void);

/**
 * Deinitialize PMS7003 and free resources
 */
void pms7003_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // PMS7003_H
