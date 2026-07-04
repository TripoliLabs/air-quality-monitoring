/**
 * Air Quality Monitoring Node — LILYGO T-Beam V1.2 (ESP32 + LoRa).
 *
 * On-target entrypoint. Uses the SAME portable core (firmware/core) as the host
 * build: sample the sensors through the HAL, encode the shared 13-byte payload,
 * transmit via LoRaWAN, deep-sleep. The ESP32 sensor/LoRa drivers live in
 * firmware/adapters/esp32 (the real PMS7003 / BME280 / SX126x implementations).
 *
 * License: AGPL-3.0
 */
#include "esp_log.h"
#include "esp_sleep.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

extern "C" {
#include "aq_payload.h"
#include "aq_sensors.h"

/* ESP32 hardware adapters (firmware/adapters/esp32). */
int esp32_pmu_init(void);
int esp32_read_pm(float *pm25, float *pm10);
int esp32_read_env(float *temp_c, float *humidity, float *pressure_hpa);
uint16_t esp32_read_battery_mv(void);
int lorawan_send_payload(const uint8_t *data, uint8_t len);
}

static const char *TAG = "main";
#define DEEP_SLEEP_US (5ULL * 60ULL * 1000000ULL) /* 5 minutes */

static const aq_sensor_hal_t HAL = {
    .read_pm = esp32_read_pm,
    .read_env = esp32_read_env,
    .read_battery_mv = esp32_read_battery_mv,
};

extern "C" void app_main(void) {
    ESP_LOGI(TAG, "Air Quality node v0.1.0 starting");

    /* Power the LoRa + GPS rails (and battery ADC) before touching the radio or
     * the I2C sensors — on the T-Beam V1.2 the SX1276 rail is PMU-switched. */
    if (esp32_pmu_init() != 0) {
        ESP_LOGW(TAG, "PMU init failed — radio/sensors may be unpowered");
    }

    aq_reading_t reading;
    if (aq_sample(&HAL, &reading) == 0) {
        uint8_t payload[AQ_PAYLOAD_LEN];
        aq_payload_encode(&reading, payload);
        lorawan_send_payload(payload, AQ_PAYLOAD_LEN);
        ESP_LOGI(TAG, "uplink sent: pm2.5=%.1f aqi-source bytes=%d", reading.pm25, AQ_PAYLOAD_LEN);
    } else {
        ESP_LOGE(TAG, "sensor sample failed");
    }

    esp_sleep_enable_timer_wakeup(DEEP_SLEEP_US);
    esp_deep_sleep_start();
}
