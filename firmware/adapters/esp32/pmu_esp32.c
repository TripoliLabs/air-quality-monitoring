/**
 * AXP2101 PMU adapter (LILYGO T-Beam V1.2). Powers the SX1276 LoRa + GPS rails.
 * Without this the radio has no VDD and RadioLib's begin() fails on a dead chip.
 *
 * !! HARDWARE VERIFICATION REQUIRED !!
 *   - The T-Beam V1.2 carries the AXP2101; the V1.1 used the AXP192 — a different
 *     chip with a different register map. Confirm which is on YOUR board (this
 *     logs the chip id so you can check).
 *   - The exact rail→peripheral map (which ALDO feeds LoRa vs GPS) has varied
 *     across LilyGO revisions, so we power BOTH ALDO2 and ALDO3 at 3.3V — the
 *     LoRa rail is then up whichever it is. Trim to the confirmed rail to save a
 *     little power once validated.
 *   - For production, prefer LilyGO's XPowersLib; this is a minimal raw-register
 *     bring-up to get the radio powered on day one.
 */
#include "pmu_esp32.h"

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "i2c_esp32.h"

static const char *TAG = "pmu";

#define AXP2101_ADDR 0x34
#define AXP2101_REG_CHIP_ID 0x03
#define AXP2101_CHIP_ID 0x4A
#define AXP2101_REG_ADC_EN 0x30
#define AXP2101_REG_VBAT_H 0x34
#define AXP2101_REG_VBAT_L 0x35
#define AXP2101_REG_LDO_EN0 0x90
#define AXP2101_REG_ALDO2 0x93
#define AXP2101_REG_ALDO3 0x94
#define AXP2101_ALDO_3V3 0x1C /* (3300 mV - 500) / 100 = 28 */

static i2c_master_dev_handle_t s_dev = NULL;

static esp_err_t pmu_w(uint8_t reg, uint8_t val) {
    uint8_t buf[2] = {reg, val};
    return i2c_master_transmit(s_dev, buf, sizeof(buf), 1000 /* ms */);
}

static esp_err_t pmu_r(uint8_t reg, uint8_t *val) {
    return i2c_master_transmit_receive(s_dev, &reg, 1, val, 1, 1000 /* ms */);
}

int esp32_pmu_init(void) {
    if (s_dev != NULL) {
        return 0;
    }
    i2c_master_bus_handle_t bus = esp32_i2c_bus();
    if (bus == NULL) {
        return -1;
    }
    const i2c_device_config_t cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = AXP2101_ADDR,
        .scl_speed_hz = 100000,
    };
    if (i2c_master_bus_add_device(bus, &cfg, &s_dev) != ESP_OK) {
        ESP_LOGE(TAG, "add AXP2101 failed");
        s_dev = NULL;
        return -1;
    }

    uint8_t id = 0;
    if (pmu_r(AXP2101_REG_CHIP_ID, &id) != ESP_OK) {
        ESP_LOGE(TAG, "AXP2101 not responding on I2C 0x34");
        return -1;
    }
    if (id != AXP2101_CHIP_ID) {
        ESP_LOGW(TAG, "unexpected PMU id 0x%02x (expected 0x4A) — AXP192 board?", id);
        /* Continue: the rail writes below are AXP2101-specific and simply won't
         * take on an AXP192, which the chip-id warning has already surfaced. */
    }

    /* LoRa + GPS rails at 3.3V (see header re: exact map). */
    pmu_w(AXP2101_REG_ALDO2, AXP2101_ALDO_3V3);
    pmu_w(AXP2101_REG_ALDO3, AXP2101_ALDO_3V3);
    uint8_t en = 0;
    pmu_r(AXP2101_REG_LDO_EN0, &en);
    pmu_w(AXP2101_REG_LDO_EN0, (uint8_t)(en | 0x06)); /* ALDO2 (bit1) + ALDO3 (bit2) */

    /* Enable the battery-voltage ADC channel. */
    uint8_t adc = 0;
    pmu_r(AXP2101_REG_ADC_EN, &adc);
    pmu_w(AXP2101_REG_ADC_EN, (uint8_t)(adc | 0x01));

    ESP_LOGI(TAG, "AXP2101 rails up (ALDO2+ALDO3 @ 3.3V)");
    vTaskDelay(pdMS_TO_TICKS(50)); /* let rails settle before radio/sensors */
    return 0;
}

uint16_t esp32_pmu_battery_mv(void) {
    if (s_dev == NULL) {
        return 0;
    }
    uint8_t h = 0, l = 0;
    if (pmu_r(AXP2101_REG_VBAT_H, &h) != ESP_OK || pmu_r(AXP2101_REG_VBAT_L, &l) != ESP_OK) {
        return 0;
    }
    /* AXP2101 VBAT ADC: 14-bit, already in millivolts. */
    return (uint16_t)(((h & 0x3F) << 8) | l);
}
