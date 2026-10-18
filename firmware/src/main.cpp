/**
 * Air Quality Monitoring Node — LILYGO T-Beam V1.2 (ESP32 + LoRa).
 *
 * On-target entrypoint. Uses the SAME portable core (firmware/core) as the host
 * build: sample the sensors through the HAL, encode the shared 13-byte payload,
 * transmit via LoRaWAN, deep-sleep. The ESP32 sensor/LoRa drivers live in
 * firmware/adapters/esp32 (the real PMS7003 / BME280 / SX126x implementations).
 *
 * Each wake does one of two things (decided by core/aq_config.c):
 *   - a reading: sample, calibrate, send on fPort 2;
 *   - a config report: send the active settings on fPort 11, after a config
 *     downlink or the first reading of a cold boot.
 * A config downlink arriving after either uplink is applied at once, stored in
 * NVS if it changed anything, and confirmed by the next wake's report.
 *
 * License: AGPL-3.0
 */
#include "esp_attr.h"
#include "esp_log.h"
#include "esp_sleep.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

extern "C" {
#include "aq_config.h"
#include "aq_payload.h"
#include "aq_sensors.h"
#include "config_store_esp32.h"
#include "lora_esp32.h"

/* ESP32 hardware adapters (firmware/adapters/esp32). */
int esp32_pmu_init(void);
int esp32_read_pm(float *pm25, float *pm10);
int esp32_read_env(float *temp_c, float *humidity, float *pressure_hpa);
uint16_t esp32_read_battery_mv(void);
}

static const char *TAG = "main";

static const aq_sensor_hal_t HAL = {
    .read_pm = esp32_read_pm,
    .read_env = esp32_read_env,
    .read_battery_mv = esp32_read_battery_mv,
};

/* Config and report bookkeeping, kept in RTC RAM across deep sleep. RTC_DATA_ATTR
 * is re-initialised on every boot that is not a deep-sleep wake, so s_have_state
 * is false after a power cut or reset and the config is reloaded from NVS. */
RTC_DATA_ATTR static aq_node_state_t s_state;
RTC_DATA_ATTR static bool s_have_state = false;

/* Apply a config downlink, if one came back, and persist a change. */
static void handle_downlink(const aq_lorawan_downlink_t *down) {
    if (!down->received) return;
    const int changed = aq_state_on_downlink(&s_state, down->fport, down->data, down->len);
    if (down->fport != AQ_DOWNLINK_FPORT) return;
    ESP_LOGI(TAG, "config downlink 0x%02x: result %u, interval %us", s_state.last_cmd,
             s_state.last_result, s_state.cfg.sample_interval_s);
    if (changed && esp32_config_save(&s_state.cfg) != 0) {
        /* Still applied for this run of deep sleeps; a power cut would revert it. */
        ESP_LOGW(TAG, "config applied but not saved to flash");
    }
}

static void send_reading(aq_lorawan_downlink_t *down) {
    aq_reading_t reading;
    /* A node whose sensors have all failed still sends: the payload carries the
     * battery and clear presence bits (ingestion keeps it out of the readings),
     * and the uplink is what keeps the node reachable for a config downlink and
     * visibly alive rather than silent. */
    if (aq_sample(&HAL, &reading) != 0) {
        ESP_LOGW(TAG, "no sensor reported — sending a battery-only heartbeat");
    }
    aq_config_calibrate(&s_state.cfg, &reading);

    uint8_t payload[AQ_PAYLOAD_LEN];
    aq_payload_encode(&reading, payload);
    if (lorawan_send(payload, AQ_PAYLOAD_LEN, AQ_DATA_FPORT, down) == 0) {
        ESP_LOGI(TAG, "uplink sent: pm2.5=%.1f present=0x%02x", reading.pm25, reading.present);
    } else {
        ESP_LOGE(TAG, "uplink failed");
    }
}

static void send_report(aq_lorawan_downlink_t *down) {
    uint8_t report[AQ_REPORT_LEN];
    aq_config_report_encode(&s_state, report);
    /* Not retried on failure: the server sees no confirmation and can resend. */
    aq_state_report_done(&s_state);
    if (lorawan_send(report, AQ_REPORT_LEN, AQ_REPORT_FPORT, down) == 0) {
        ESP_LOGI(TAG, "config report sent: interval %us", s_state.cfg.sample_interval_s);
    } else {
        ESP_LOGE(TAG, "config report failed");
    }
}

extern "C" void app_main(void) {
    ESP_LOGI(TAG, "Air Quality node v0.1.0 starting");

    /* Power the LoRa + GPS rails (and battery ADC) before touching the radio or
     * the I2C sensors — on the T-Beam V1.2 the SX1276 rail is PMU-switched. */
    if (esp32_pmu_init() != 0) {
        ESP_LOGW(TAG, "PMU init failed — radio/sensors may be unpowered");
    }

    const bool cold_boot = !s_have_state;
    if (cold_boot) {
        aq_config_t stored;
        const bool loaded = esp32_config_load(&stored) == 0;
        aq_state_init(&s_state, loaded ? &stored : NULL);
        s_have_state = true;
        ESP_LOGI(TAG, "%s config: interval %us", loaded ? "stored" : "default",
                 s_state.cfg.sample_interval_s);
    }

    static aq_lorawan_downlink_t down; /* static: too large for the main task stack */
    if (aq_state_report_due(&s_state)) {
        send_report(&down);
    } else {
        send_reading(&down);
        /* Tell the server what a freshly booted node is running, unless a
         * downlink below queues a report anyway. */
        if (cold_boot) aq_state_request_report(&s_state);
    }
    handle_downlink(&down);

    const uint32_t sleep_s = aq_state_sleep_s(&s_state);
    ESP_LOGI(TAG, "sleeping %us", (unsigned)sleep_s);
    esp_sleep_enable_timer_wakeup((uint64_t)sleep_s * 1000000ULL);
    esp_deep_sleep_start();
}
