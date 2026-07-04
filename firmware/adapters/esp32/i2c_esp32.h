/**
 * Shared I2C master bus for the on-target adapters. The AXP2101 PMU and the
 * BME280 sit on the SAME bus (T-Beam V1.2: SDA=21 / SCL=22), so both go through
 * this create-once helper instead of each installing its own bus on I2C_NUM_0.
 */
#ifndef AQ_I2C_ESP32_H
#define AQ_I2C_ESP32_H

#include "driver/i2c_master.h"

/* Returns the shared bus handle (created on first call), or NULL on failure. */
i2c_master_bus_handle_t esp32_i2c_bus(void);

#endif /* AQ_I2C_ESP32_H */
