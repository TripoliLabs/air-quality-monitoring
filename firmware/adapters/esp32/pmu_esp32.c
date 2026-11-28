/**
 * AXP2101 PMU adapter (LILYGO T-Beam V1.2). Powers the SX1276 LoRa + GPS rails
 * and the header's 3.3 V pins that feed the sensors.
 * Without this the radio has no VDD and RadioLib's begin() fails on a dead chip.
 *
 * Rail map, from LilyGO's schematic (schematic/LilyGo_TBeam_V1.2.pdf):
 *   - ALDO2 -> LORA_VCC (SX1276), ALDO3 -> GPS_VDD.
 *   - DCDC3 -> VCC_2_5V, which is BOTH 3.3 V pins on the pin header (U14 pins 7
 *     and 11). The BME280 and the PMS7003's 5 V booster hang off these pins, so
 *     DCDC3 must be on and at 3.3 V or the sensors are unpowered.
 *   - The header's "5V" pin is VSYS (system rail, follows the battery or the USB
 *     input), not a regulated 5 V; there is no battery pin on the header.
 *
 * !! HARDWARE VERIFICATION REQUIRED !!
 *   - The T-Beam V1.2 carries the AXP2101; the V1.1 used the AXP192 — a different
 *     chip with a different register map. Confirm which is on YOUR board (this
 *     logs the chip id so you can check).
 *   - The V1.2 schematic puts LoRa on ALDO2 and GPS on ALDO3. Both stay on for
 *     now; the firmware does not use the GPS, so ALDO3 could be dropped later to
 *     save a little power once that is measured on a board.
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
#define AXP2101_REG_DC_EN 0x80   /* DC_ONOFF_DVM_CTRL: bit n enables DCDC(n+1) */
#define AXP2101_REG_DC3_VOL 0x84 /* DC_VOL2_CTRL: bit 7 is DVM, bits 6:0 the voltage */
#define AXP2101_DC3_EN 0x04      /* bit 2 */
/* DCDC3 in its 1.6-3.4 V range: code = (mV - 1600) / 100 + 88, so 3.3 V is 105. */
#define AXP2101_DC3_3V3 0x69

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

    /* LoRa + GPS rails at 3.3V. */
    pmu_w(AXP2101_REG_ALDO2, AXP2101_ALDO_3V3);
    pmu_w(AXP2101_REG_ALDO3, AXP2101_ALDO_3V3);
    uint8_t en = 0;
    pmu_r(AXP2101_REG_LDO_EN0, &en);
    pmu_w(AXP2101_REG_LDO_EN0, (uint8_t)(en | 0x06)); /* ALDO2 (bit1) + ALDO3 (bit2) */

    /* Sensor rail: DCDC3 at 3.3 V on the header pins. It stays on through deep
     * sleep. Switching it off would leave the unpowered BME280's I2C pull-ups
     * dragging the shared bus (the PMU itself sits on it) towards ground; the
     * PMS7003's fan is put to sleep by a serial command instead. */
    uint8_t dv = 0;
    pmu_r(AXP2101_REG_DC3_VOL, &dv);
    pmu_w(AXP2101_REG_DC3_VOL, (uint8_t)((dv & 0x80) | AXP2101_DC3_3V3));
    uint8_t dc = 0;
    pmu_r(AXP2101_REG_DC_EN, &dc);
    pmu_w(AXP2101_REG_DC_EN, (uint8_t)(dc | AXP2101_DC3_EN));
    dv = 0;
    dc = 0;
    if (pmu_r(AXP2101_REG_DC3_VOL, &dv) != ESP_OK || pmu_r(AXP2101_REG_DC_EN, &dc) != ESP_OK ||
        (dv & 0x7F) != AXP2101_DC3_3V3 || !(dc & AXP2101_DC3_EN)) {
        ESP_LOGW(TAG, "sensor rail (DCDC3) not confirmed: vol=0x%02x en=0x%02x", dv, dc);
    }

    /* Enable the battery-voltage ADC channel. */
    uint8_t adc = 0;
    pmu_r(AXP2101_REG_ADC_EN, &adc);
    pmu_w(AXP2101_REG_ADC_EN, (uint8_t)(adc | 0x01));

    ESP_LOGI(TAG, "AXP2101 rails up (ALDO2 LoRa, ALDO3 GPS, DCDC3 sensors @ 3.3V)");
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
