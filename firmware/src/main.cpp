/**
 * Air Quality Monitoring Node
 * LILYGO T-Beam V1.2 (ESP32 + LoRa + GPS)
 *
 * Measures PM2.5, PM10, temperature, humidity and transmits via LoRaWAN
 *
 * Hardware:
 * - LILYGO T-Beam V1.2 868MHz
 * - Plantower PMS7003 (PM sensor)
 * - BME280 (Temperature/Humidity/Pressure)
 *
 * License: AGPL-3.0
 */

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_sleep.h"

// Local includes
// #include "sensors/pms7003.h"
// #include "sensors/bme280.h"
// #include "lora/lorawan.h"
// #include "power/battery.h"

static const char *TAG = "main";

// Configuration
#define READING_INTERVAL_MS (5 * 60 * 1000)  // 5 minutes
#define DEEP_SLEEP_TIME_US (5 * 60 * 1000000) // 5 minutes in microseconds

/**
 * Initialize all hardware peripherals
 */
static void init_hardware(void)
{
    ESP_LOGI(TAG, "Initializing hardware...");

    // TODO: Initialize PMS7003 (UART)
    // TODO: Initialize BME280 (I2C)
    // TODO: Initialize LoRa radio (SPI)
    // TODO: Initialize battery monitoring (ADC)

    ESP_LOGI(TAG, "Hardware initialized");
}

/**
 * Read all sensor values
 */
static void read_sensors(void)
{
    ESP_LOGI(TAG, "Reading sensors...");

    // TODO: Read PMS7003 (PM2.5, PM10)
    // TODO: Read BME280 (temperature, humidity, pressure)
    // TODO: Read battery voltage

    ESP_LOGI(TAG, "Sensors read complete");
}

/**
 * Transmit data via LoRaWAN
 */
static void transmit_data(void)
{
    ESP_LOGI(TAG, "Transmitting data via LoRaWAN...");

    // TODO: Pack sensor data into payload
    // TODO: Send via LoRaWAN (OTAA or ABP)
    // TODO: Wait for TX complete

    ESP_LOGI(TAG, "Transmission complete");
}

/**
 * Enter deep sleep to conserve power
 */
static void enter_deep_sleep(void)
{
    ESP_LOGI(TAG, "Entering deep sleep for %d minutes...", DEEP_SLEEP_TIME_US / 1000000 / 60);

    // TODO: Turn off peripherals
    // TODO: Configure wake-up source

    esp_sleep_enable_timer_wakeup(DEEP_SLEEP_TIME_US);
    esp_deep_sleep_start();
}

extern "C" void app_main(void)
{
    ESP_LOGI(TAG, "Air Quality Monitor starting...");
    ESP_LOGI(TAG, "Firmware version: 0.1.0");

    // Initialize hardware
    init_hardware();

    // Main loop (runs once before deep sleep)
    while (1) {
        // Read sensors
        read_sensors();

        // Transmit data
        transmit_data();

        // Enter deep sleep
        enter_deep_sleep();

        // This line should never be reached
        vTaskDelay(pdMS_TO_TICKS(READING_INTERVAL_MS));
    }
}
