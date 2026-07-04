/**
 * Shared I2C master bus (see i2c_esp32.h). Created once, reused by the PMU and
 * BME280 adapters. Pins default to the T-Beam V1.2 wiring; override with -D.
 *
 * !! HARDWARE VERIFICATION REQUIRED !! SDA/SCL match the conventional T-Beam
 * V1.2 layout but must be confirmed against the board.
 */
#include "i2c_esp32.h"

#include "esp_log.h"

#ifndef AQ_I2C_SDA_PIN
#define AQ_I2C_SDA_PIN 21
#endif
#ifndef AQ_I2C_SCL_PIN
#define AQ_I2C_SCL_PIN 22
#endif

static const char *TAG = "i2c";
static i2c_master_bus_handle_t s_bus = NULL;

i2c_master_bus_handle_t esp32_i2c_bus(void) {
    if (s_bus != NULL) {
        return s_bus;
    }
    const i2c_master_bus_config_t cfg = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = AQ_I2C_SCL_PIN,
        .sda_io_num = AQ_I2C_SDA_PIN,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    esp_err_t err = i2c_new_master_bus(&cfg, &s_bus);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2c_new_master_bus failed: %s", esp_err_to_name(err));
        s_bus = NULL;
    }
    return s_bus;
}
