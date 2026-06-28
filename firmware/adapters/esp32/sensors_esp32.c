/**
 * ESP32 sensor HAL adapter (on-target). Implements the firmware/core sensor
 * interface (core/aq_sensors.h) against the real LILYGO T-Beam V1.2 hardware:
 *   - PMS7003 particulate sensor over UART  (driver/uart.h)
 *   - BME280 temp/humidity/pressure over I2C (driver/i2c_master.h)
 *   - battery voltage via ADC divider        (esp_adc/adc_oneshot.h)
 *
 * Signatures / return conventions are fixed by core/aq_sensors.h and mirror the
 * host simulator (firmware/sim/sensors_sim.c):
 *   - read_pm / read_env  → 0 on success, non-zero on failure
 *   - read_battery_mv     → millivolts (uint16)
 *
 * TARGET-ONLY: this file references ESP-IDF headers and is compiled only for the
 * ESP32 target (PlatformIO `build_src_filter` + main/CMakeLists.txt). The host
 * build (Makefile) excludes it, so it never reaches gcc.
 *
 * !! HARDWARE VERIFICATION REQUIRED !!  All pin assignments below are the
 * conventional LILYGO T-Beam V1.2 wiring but MUST be confirmed against the
 * physical board + the actual sensor harness before flashing. They can be
 * overridden at build time via -D flags (see platformio.ini build_flags).
 */
#include <stdint.h>
#include <string.h>

#include "driver/i2c_master.h"
#include "driver/uart.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "sensors";

/* ----------------------------------------------------------------------------
 * Pin / peripheral configuration (LILYGO T-Beam V1.2) — CONFIRM ON HARDWARE.
 * --------------------------------------------------------------------------*/

/* PMS7003 (UART, 9600 8N1). The T-Beam's primary UART (GPS) lives on the AXP192
 * power rail; these two free GPIOs are wired to the PMS7003 (PMS TX → ESP RX,
 * PMS RX → ESP TX). Confirm they are not shared with the on-board GPS/PMU. */
#ifndef AQ_PMS_UART_NUM
#define AQ_PMS_UART_NUM UART_NUM_1
#endif
#ifndef AQ_PMS_RX_PIN /* ESP32 RX  ← PMS7003 TX */
#define AQ_PMS_RX_PIN 13
#endif
#ifndef AQ_PMS_TX_PIN /* ESP32 TX  → PMS7003 RX */
#define AQ_PMS_TX_PIN 14
#endif
#define AQ_PMS_BAUD 9600
#define AQ_PMS_FRAME_LEN 32 /* full active-mode data frame */

/* BME280 (I2C). The T-Beam's I2C bus (also the AXP192 PMU) is SDA=21 / SCL=22. */
#ifndef AQ_I2C_SDA_PIN
#define AQ_I2C_SDA_PIN 21
#endif
#ifndef AQ_I2C_SCL_PIN
#define AQ_I2C_SCL_PIN 22
#endif
#ifndef AQ_BME280_ADDR
#define AQ_BME280_ADDR 0x76 /* 0x76 (SDO→GND) or 0x77 (SDO→VDD) */
#endif
#define AQ_I2C_FREQ_HZ 100000

/* Battery sense (ADC). NOTE: on the stock T-Beam V1.2 the battery is monitored
 * by the AXP192 PMU over I2C, NOT a bare ADC divider. This ADC path assumes a
 * direct 2:1 divider brought out to an ADC1 pin (GPIO35 here). If the board is
 * unmodified, battery voltage should instead be read from the AXP192 — flagged
 * for hardware verification. */
#ifndef AQ_BATT_ADC_UNIT
#define AQ_BATT_ADC_UNIT ADC_UNIT_1
#endif
#ifndef AQ_BATT_ADC_CHANNEL
#define AQ_BATT_ADC_CHANNEL ADC_CHANNEL_7 /* ADC1_CH7 = GPIO35 */
#endif
#ifndef AQ_BATT_DIVIDER_X100
#define AQ_BATT_DIVIDER_X100 200 /* 2.00× (1:1 resistor divider) ×100 */
#endif

/* ----------------------------------------------------------------------------
 * PMS7003 — particulate matter over UART.
 * --------------------------------------------------------------------------*/

static bool s_pms_ready = false;

static int pms_init(void) {
    if (s_pms_ready) {
        return 0;
    }
    const uart_config_t cfg = {
        .baud_rate = AQ_PMS_BAUD,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    esp_err_t err = uart_driver_install(AQ_PMS_UART_NUM, 256, 0, 0, NULL, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "uart_driver_install failed: %s", esp_err_to_name(err));
        return -1;
    }
    if ((err = uart_param_config(AQ_PMS_UART_NUM, &cfg)) != ESP_OK) {
        ESP_LOGE(TAG, "uart_param_config failed: %s", esp_err_to_name(err));
        return -1;
    }
    if ((err = uart_set_pin(AQ_PMS_UART_NUM, AQ_PMS_TX_PIN, AQ_PMS_RX_PIN, UART_PIN_NO_CHANGE,
                            UART_PIN_NO_CHANGE)) != ESP_OK) {
        ESP_LOGE(TAG, "uart_set_pin failed: %s", esp_err_to_name(err));
        return -1;
    }
    s_pms_ready = true;
    return 0;
}

/* Read exactly one byte with a per-byte timeout. Returns 1 on success, 0 on
 * timeout. */
static int pms_read_byte(uint8_t *out, TickType_t timeout) {
    return uart_read_bytes(AQ_PMS_UART_NUM, out, 1, timeout) == 1 ? 1 : 0;
}

/*
 * PMS7003 active-mode frame (32 bytes, all multi-byte fields BIG-endian):
 *   [0]      0x42  start char 1
 *   [1]      0x4D  start char 2
 *   [2..3]   frame length (= 2*13 + 2 = 28)
 *   [4..5]   PM1.0  (CF=1, factory)
 *   [6..7]   PM2.5  (CF=1, factory)
 *   [8..9]   PM10   (CF=1, factory)
 *   [10..11] PM1.0  (atmospheric)
 *   [12..13] PM2.5  (atmospheric)   ← reported
 *   [14..15] PM10   (atmospheric)   ← reported
 *   [16..27] particle counts (0.3..10 µm)
 *   [28]     version
 *   [29]     error code
 *   [30..31] checksum = sum of bytes [0..29]
 */
static int esp32_read_pm_frame(float *pm25, float *pm10) {
    /* Hunt for the 0x42 0x4D preamble, allowing up to a few stale frames. */
    const TickType_t byte_to = pdMS_TO_TICKS(1500);
    for (int attempt = 0; attempt < AQ_PMS_FRAME_LEN * 4; attempt++) {
        uint8_t b;
        if (!pms_read_byte(&b, byte_to)) {
            ESP_LOGW(TAG, "PMS7003 read timeout");
            return -1;
        }
        if (b != 0x42) {
            continue;
        }
        if (!pms_read_byte(&b, byte_to)) {
            return -1;
        }
        if (b != 0x4D) {
            continue;
        }

        uint8_t frame[AQ_PMS_FRAME_LEN];
        frame[0] = 0x42;
        frame[1] = 0x4D;
        int got = uart_read_bytes(AQ_PMS_UART_NUM, &frame[2], AQ_PMS_FRAME_LEN - 2, byte_to);
        if (got != AQ_PMS_FRAME_LEN - 2) {
            ESP_LOGW(TAG, "PMS7003 short frame (%d bytes)", got);
            return -1;
        }

        uint16_t frame_len = (uint16_t)((frame[2] << 8) | frame[3]);
        if (frame_len != AQ_PMS_FRAME_LEN - 4) {
            ESP_LOGW(TAG, "PMS7003 bad length field: %u", frame_len);
            continue; /* desync — keep hunting */
        }

        uint16_t sum = 0;
        for (int i = 0; i < AQ_PMS_FRAME_LEN - 2; i++) {
            sum += frame[i];
        }
        uint16_t checksum = (uint16_t)((frame[30] << 8) | frame[31]);
        if (sum != checksum) {
            ESP_LOGW(TAG, "PMS7003 checksum mismatch: calc=%u recv=%u", sum, checksum);
            continue;
        }

        uint16_t pm25_raw = (uint16_t)((frame[12] << 8) | frame[13]);
        uint16_t pm10_raw = (uint16_t)((frame[14] << 8) | frame[15]);
        *pm25 = (float)pm25_raw;
        *pm10 = (float)pm10_raw;
        return 0;
    }
    ESP_LOGW(TAG, "PMS7003 no valid frame found");
    return -1;
}

int esp32_read_pm(float *pm25, float *pm10) {
    if (pms_init() != 0) {
        return -1;
    }
    /* Drop any partially-buffered frame so we sync on a fresh one. */
    uart_flush_input(AQ_PMS_UART_NUM);
    return esp32_read_pm_frame(pm25, pm10);
}

/* ----------------------------------------------------------------------------
 * BME280 — temperature / humidity / pressure over I2C, with Bosch compensation.
 * --------------------------------------------------------------------------*/

#define BME280_REG_ID 0xD0
#define BME280_REG_RESET 0xE0
#define BME280_REG_CTRL_HUM 0xF2
#define BME280_REG_STATUS 0xF3
#define BME280_REG_CTRL_MEAS 0xF4
#define BME280_REG_CONFIG 0xF5
#define BME280_REG_PRESS_MSB 0xF7
#define BME280_REG_CALIB00 0x88 /* 0x88..0xA1 (T1..T3, P1..P9, H1) */
#define BME280_REG_CALIB26 0xE1 /* 0xE1..0xE7 (H2..H6) */
#define BME280_CHIP_ID 0x60

typedef struct {
    uint16_t T1;
    int16_t T2, T3;
    uint16_t P1;
    int16_t P2, P3, P4, P5, P6, P7, P8, P9;
    uint8_t H1;
    int16_t H2;
    uint8_t H3;
    int16_t H4, H5;
    int8_t H6;
    int32_t t_fine;
} bme280_calib_t;

static i2c_master_bus_handle_t s_i2c_bus = NULL;
static i2c_master_dev_handle_t s_bme_dev = NULL;
static bme280_calib_t s_calib;
static bool s_bme_ready = false;

static esp_err_t bme_write_reg(uint8_t reg, uint8_t val) {
    uint8_t buf[2] = {reg, val};
    return i2c_master_transmit(s_bme_dev, buf, sizeof(buf), 1000 /* ms */);
}

static esp_err_t bme_read(uint8_t reg, uint8_t *dst, size_t len) {
    return i2c_master_transmit_receive(s_bme_dev, &reg, 1, dst, len, 1000 /* ms */);
}

static esp_err_t bme_load_calibration(void) {
    uint8_t c1[26];
    uint8_t c2[7];
    esp_err_t err;
    if ((err = bme_read(BME280_REG_CALIB00, c1, sizeof(c1))) != ESP_OK) {
        return err;
    }
    if ((err = bme_read(BME280_REG_CALIB26, c2, sizeof(c2))) != ESP_OK) {
        return err;
    }
    s_calib.T1 = (uint16_t)(c1[0] | (c1[1] << 8));
    s_calib.T2 = (int16_t)(c1[2] | (c1[3] << 8));
    s_calib.T3 = (int16_t)(c1[4] | (c1[5] << 8));
    s_calib.P1 = (uint16_t)(c1[6] | (c1[7] << 8));
    s_calib.P2 = (int16_t)(c1[8] | (c1[9] << 8));
    s_calib.P3 = (int16_t)(c1[10] | (c1[11] << 8));
    s_calib.P4 = (int16_t)(c1[12] | (c1[13] << 8));
    s_calib.P5 = (int16_t)(c1[14] | (c1[15] << 8));
    s_calib.P6 = (int16_t)(c1[16] | (c1[17] << 8));
    s_calib.P7 = (int16_t)(c1[18] | (c1[19] << 8));
    s_calib.P8 = (int16_t)(c1[20] | (c1[21] << 8));
    s_calib.P9 = (int16_t)(c1[22] | (c1[23] << 8));
    /* c1[24] is reserved (0xA0); c1[25] is H1 (0xA1). */
    s_calib.H1 = c1[25];
    s_calib.H2 = (int16_t)(c2[0] | (c2[1] << 8));
    s_calib.H3 = c2[2];
    /* H4: [11:4]=0xE4, [3:0]=low nibble of 0xE5 ; H5: [11:4]=0xE6, [3:0]=high nibble of 0xE5 */
    s_calib.H4 = (int16_t)((c2[3] << 4) | (c2[4] & 0x0F));
    s_calib.H5 = (int16_t)((c2[5] << 4) | (c2[4] >> 4));
    s_calib.H6 = (int8_t)c2[6];
    return ESP_OK;
}

static int bme_init(void) {
    if (s_bme_ready) {
        return 0;
    }
    esp_err_t err;
    if (s_i2c_bus == NULL) {
        const i2c_master_bus_config_t bus_cfg = {
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .i2c_port = I2C_NUM_0,
            .scl_io_num = AQ_I2C_SCL_PIN,
            .sda_io_num = AQ_I2C_SDA_PIN,
            .glitch_ignore_cnt = 7,
            .flags.enable_internal_pullup = true,
        };
        if ((err = i2c_new_master_bus(&bus_cfg, &s_i2c_bus)) != ESP_OK) {
            ESP_LOGE(TAG, "i2c_new_master_bus failed: %s", esp_err_to_name(err));
            return -1;
        }
    }
    const i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = AQ_BME280_ADDR,
        .scl_speed_hz = AQ_I2C_FREQ_HZ,
    };
    if ((err = i2c_master_bus_add_device(s_i2c_bus, &dev_cfg, &s_bme_dev)) != ESP_OK) {
        ESP_LOGE(TAG, "i2c add BME280 failed: %s", esp_err_to_name(err));
        return -1;
    }

    uint8_t id = 0;
    if (bme_read(BME280_REG_ID, &id, 1) != ESP_OK || id != BME280_CHIP_ID) {
        ESP_LOGE(TAG, "BME280 not found (id=0x%02x, expected 0x60)", id);
        return -1;
    }
    if (bme_load_calibration() != ESP_OK) {
        ESP_LOGE(TAG, "BME280 calibration read failed");
        return -1;
    }

    /* Humidity oversampling ×1 (must be written BEFORE ctrl_meas to take effect). */
    if (bme_write_reg(BME280_REG_CTRL_HUM, 0x01) != ESP_OK) {
        return -1;
    }
    /* config: standby 0.5ms, IIR filter off. */
    if (bme_write_reg(BME280_REG_CONFIG, 0x00) != ESP_OK) {
        return -1;
    }
    s_bme_ready = true;
    return 0;
}

/* Bosch BME280 datasheet compensation (32-bit integer variants), returning
 * physical units as floats. t_fine is carried between temperature/pressure/
 * humidity as the datasheet requires. */
static float bme_compensate_temp(int32_t adc_T) {
    int32_t var1 = ((((adc_T >> 3) - ((int32_t)s_calib.T1 << 1))) * ((int32_t)s_calib.T2)) >> 11;
    int32_t var2 =
        (((((adc_T >> 4) - ((int32_t)s_calib.T1)) * ((adc_T >> 4) - ((int32_t)s_calib.T1))) >> 12) *
         ((int32_t)s_calib.T3)) >>
        14;
    s_calib.t_fine = var1 + var2;
    int32_t T = (s_calib.t_fine * 5 + 128) >> 8; /* °C ×100 */
    return (float)T / 100.0f;
}

static float bme_compensate_pressure(int32_t adc_P) {
    int64_t var1 = ((int64_t)s_calib.t_fine) - 128000;
    int64_t var2 = var1 * var1 * (int64_t)s_calib.P6;
    var2 = var2 + ((var1 * (int64_t)s_calib.P5) << 17);
    var2 = var2 + (((int64_t)s_calib.P4) << 35);
    var1 = ((var1 * var1 * (int64_t)s_calib.P3) >> 8) + ((var1 * (int64_t)s_calib.P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)s_calib.P1) >> 33;
    if (var1 == 0) {
        return 0.0f; /* avoid divide-by-zero */
    }
    int64_t p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)s_calib.P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)s_calib.P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)s_calib.P7) << 4); /* Pa in Q24.8 */
    return (float)p / 256.0f / 100.0f;                           /* Pa → hPa */
}

static float bme_compensate_humidity(int32_t adc_H) {
    int32_t v = s_calib.t_fine - (int32_t)76800;
    v = ((((adc_H << 14) - (((int32_t)s_calib.H4) << 20) - (((int32_t)s_calib.H5) * v)) +
          ((int32_t)16384)) >>
         15) *
        (((((((v * ((int32_t)s_calib.H6)) >> 10) *
             (((v * ((int32_t)s_calib.H3)) >> 11) + ((int32_t)32768))) >>
            10) +
           ((int32_t)2097152)) *
              ((int32_t)s_calib.H2) +
          8192) >>
         14);
    v = v - (((((v >> 15) * (v >> 15)) >> 7) * ((int32_t)s_calib.H1)) >> 4);
    v = v < 0 ? 0 : v;
    v = v > 419430400 ? 419430400 : v;
    return (float)(v >> 12) / 1024.0f; /* %RH */
}

int esp32_read_env(float *temp_c, float *humidity, float *pressure_hpa) {
    if (bme_init() != 0) {
        return -1;
    }
    /* Trigger a forced-mode measurement: osrs_t=×1, osrs_p=×1, mode=forced(01). */
    if (bme_write_reg(BME280_REG_CTRL_MEAS, (0x01 << 5) | (0x01 << 2) | 0x01) != ESP_OK) {
        return -1;
    }
    /* Wait for the conversion to complete (status bit 3 = measuring). */
    for (int i = 0; i < 50; i++) {
        uint8_t status = 0;
        if (bme_read(BME280_REG_STATUS, &status, 1) != ESP_OK) {
            return -1;
        }
        if ((status & 0x08) == 0) {
            break;
        }
        vTaskDelay(pdMS_TO_TICKS(2));
    }

    uint8_t d[8];
    if (bme_read(BME280_REG_PRESS_MSB, d, sizeof(d)) != ESP_OK) {
        return -1;
    }
    int32_t adc_P = ((int32_t)d[0] << 12) | ((int32_t)d[1] << 4) | (d[2] >> 4);
    int32_t adc_T = ((int32_t)d[3] << 12) | ((int32_t)d[4] << 4) | (d[5] >> 4);
    int32_t adc_H = ((int32_t)d[6] << 8) | d[7];

    /* Temperature MUST be compensated first — it sets t_fine for P and H. */
    *temp_c = bme_compensate_temp(adc_T);
    *pressure_hpa = bme_compensate_pressure(adc_P);
    *humidity = bme_compensate_humidity(adc_H);
    return 0;
}

/* ----------------------------------------------------------------------------
 * Battery voltage via ADC oneshot.
 * --------------------------------------------------------------------------*/

static adc_oneshot_unit_handle_t s_adc = NULL;
static adc_cali_handle_t s_adc_cali = NULL;
static bool s_adc_calibrated = false;
static bool s_adc_ready = false;

static int batt_init(void) {
    if (s_adc_ready) {
        return 0;
    }
    const adc_oneshot_unit_init_cfg_t unit_cfg = {.unit_id = AQ_BATT_ADC_UNIT};
    if (adc_oneshot_new_unit(&unit_cfg, &s_adc) != ESP_OK) {
        ESP_LOGE(TAG, "adc_oneshot_new_unit failed");
        return -1;
    }
    const adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12, /* full-scale ~0..3.3V (post-divider) */
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    if (adc_oneshot_config_channel(s_adc, AQ_BATT_ADC_CHANNEL, &chan_cfg) != ESP_OK) {
        ESP_LOGE(TAG, "adc_oneshot_config_channel failed");
        return -1;
    }

    /* Calibration: prefer curve-fitting (esp32 uses line-fitting). Best-effort —
     * if unavailable we fall back to a nominal linear conversion below. */
#if ADC_CALI_SCHEME_CURVE_FITTING_SUPPORTED
    const adc_cali_curve_fitting_config_t cal_cfg = {
        .unit_id = AQ_BATT_ADC_UNIT,
        .chan = AQ_BATT_ADC_CHANNEL,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    s_adc_calibrated = adc_cali_create_scheme_curve_fitting(&cal_cfg, &s_adc_cali) == ESP_OK;
#elif ADC_CALI_SCHEME_LINE_FITTING_SUPPORTED
    const adc_cali_line_fitting_config_t cal_cfg = {
        .unit_id = AQ_BATT_ADC_UNIT,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    s_adc_calibrated = adc_cali_create_scheme_line_fitting(&cal_cfg, &s_adc_cali) == ESP_OK;
#endif
    s_adc_ready = true;
    return 0;
}

uint16_t esp32_read_battery_mv(void) {
    if (batt_init() != 0) {
        return 0;
    }
    /* Average a few samples to reduce noise. */
    int32_t acc_mv = 0;
    const int samples = 8;
    int valid = 0;
    for (int i = 0; i < samples; i++) {
        int raw = 0;
        if (adc_oneshot_read(s_adc, AQ_BATT_ADC_CHANNEL, &raw) != ESP_OK) {
            continue;
        }
        int mv = 0;
        if (s_adc_calibrated && adc_cali_raw_to_voltage(s_adc_cali, raw, &mv) == ESP_OK) {
            /* mv is the pin voltage in millivolts */
        } else {
            /* Fallback: assume 12-bit full scale ≈ 3100 mV at 12 dB atten. */
            mv = (raw * 3100) / 4095;
        }
        acc_mv += mv;
        valid++;
    }
    if (valid == 0) {
        return 0;
    }
    int32_t pin_mv = acc_mv / valid;
    /* Undo the external resistor divider to recover the pack voltage. */
    int32_t batt_mv = (pin_mv * AQ_BATT_DIVIDER_X100) / 100;
    if (batt_mv < 0) {
        batt_mv = 0;
    }
    if (batt_mv > 65535) {
        batt_mv = 65535;
    }
    return (uint16_t)batt_mv;
}
