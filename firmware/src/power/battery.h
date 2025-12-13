/**
 * Battery Management
 * Monitors battery voltage and charging status
 *
 * Battery: Samsung INR18650-30Q 3000mAh
 * Charger: TP4056 with protection circuit
 */

#ifndef BATTERY_H
#define BATTERY_H

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Battery status structure
 */
typedef struct {
    uint16_t voltage_mv;    // Battery voltage in millivolts
    uint8_t percentage;     // Estimated charge percentage (0-100)
    bool is_charging;       // true if USB power connected
    bool is_low;            // true if battery critically low
} battery_status_t;

/**
 * Initialize battery monitoring
 * @param adc_pin ADC GPIO pin for voltage measurement
 * @return ESP_OK on success
 */
esp_err_t battery_init(int adc_pin);

/**
 * Read battery status
 * @param status Pointer to status structure to fill
 * @return ESP_OK on success
 */
esp_err_t battery_read(battery_status_t *status);

/**
 * Get battery voltage in millivolts
 * @return Voltage in mV
 */
uint16_t battery_get_voltage(void);

/**
 * Get estimated battery percentage
 * @return Percentage (0-100)
 */
uint8_t battery_get_percentage(void);

/**
 * Check if battery is critically low
 * @return true if voltage below threshold
 */
bool battery_is_low(void);

/**
 * Deinitialize battery monitoring
 */
void battery_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // BATTERY_H
