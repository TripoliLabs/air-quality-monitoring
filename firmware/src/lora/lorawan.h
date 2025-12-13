/**
 * LoRaWAN Communication Layer
 * Handles LoRaWAN OTAA/ABP join and data transmission
 *
 * Frequency: 868MHz (EU/Middle East)
 * Radio: SX1262 (LILYGO T-Beam V1.2)
 */

#ifndef LORAWAN_H
#define LORAWAN_H

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * LoRaWAN configuration structure
 */
typedef struct {
    uint8_t dev_eui[8];   // Device EUI (unique identifier)
    uint8_t app_eui[8];   // Application EUI (JoinEUI)
    uint8_t app_key[16];  // Application Key (for OTAA)
} lorawan_config_t;

/**
 * LoRaWAN TX result
 */
typedef enum {
    LORAWAN_TX_OK = 0,
    LORAWAN_TX_FAILED,
    LORAWAN_TX_NOT_JOINED,
    LORAWAN_TX_DUTY_CYCLE,
} lorawan_tx_result_t;

/**
 * Initialize LoRaWAN stack
 * @param config Pointer to configuration structure
 * @return ESP_OK on success
 */
esp_err_t lorawan_init(const lorawan_config_t *config);

/**
 * Join network using OTAA
 * @param timeout_ms Join timeout in milliseconds
 * @return ESP_OK on successful join
 */
esp_err_t lorawan_join(uint32_t timeout_ms);

/**
 * Check if device is joined to network
 * @return true if joined
 */
bool lorawan_is_joined(void);

/**
 * Send data on specified port
 * @param port LoRaWAN port (1-223)
 * @param data Pointer to data buffer
 * @param len Length of data
 * @param confirmed true for confirmed uplink
 * @return TX result
 */
lorawan_tx_result_t lorawan_send(uint8_t port, const uint8_t *data, uint8_t len, bool confirmed);

/**
 * Get last RSSI (signal strength)
 * @return RSSI in dBm
 */
int16_t lorawan_get_rssi(void);

/**
 * Get last SNR (signal-to-noise ratio)
 * @return SNR in dB
 */
int8_t lorawan_get_snr(void);

/**
 * Put radio into sleep mode
 */
void lorawan_sleep(void);

/**
 * Deinitialize LoRaWAN stack
 */
void lorawan_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // LORAWAN_H
