/**
 * EspHal — RadioLib hardware-abstraction layer for native ESP-IDF (no Arduino).
 *
 * VENDORED + ADAPTED from RadioLib's official example
 *   examples/NonArduino/ESP-IDF/main/EspHal.h
 * RadioLib (https://github.com/jgromes/RadioLib) is MIT-licensed; this file is
 * its ESP-IDF SPI/GPIO HAL so RadioLib can drive the SX1276 under the project's
 * `framework = espidf` build (there is no Arduino layer to provide a HAL).
 *
 * TARGET-ONLY and only meaningful when RadioLib is on the include path — it is
 * included exclusively from inside the `__has_include(<RadioLib.h>)` guard in
 * lora_esp32.cpp, so the host build and a RadioLib-less ESP-IDF build never see
 * it.
 *
 * !! HARDWARE VERIFICATION REQUIRED !!  SPI host selection, pin modes and the
 * SPI clock must be confirmed on the LILYGO T-Beam V1.2 before flashing.
 */
#ifndef AQ_ESP_HAL_H
#define AQ_ESP_HAL_H

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_rom_sys.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "hal/RadioLibHal.h"

/* SPI host wired to the SX1276 on the T-Beam (VSPI / SPI3 on classic ESP32). */
#ifndef AQ_LORA_SPI_HOST
#define AQ_LORA_SPI_HOST SPI3_HOST
#endif
#ifndef AQ_LORA_SPI_HZ
#define AQ_LORA_SPI_HZ (2 * 1000 * 1000)
#endif

class EspHal : public RadioLibHal {
  public:
    EspHal(int8_t sck, int8_t miso, int8_t mosi)
        : RadioLibHal(GPIO_MODE_INPUT, GPIO_MODE_OUTPUT, 0, 1, GPIO_INTR_POSEDGE,
                      GPIO_INTR_NEGEDGE),
          spiSCK(sck), spiMISO(miso), spiMOSI(mosi) {}

    void init() override { spiBegin(); }
    void term() override { spiEnd(); }

    void pinMode(uint32_t pin, uint32_t mode) override {
        if (pin == RADIOLIB_NC) {
            return;
        }
        gpio_config_t conf = {
            .pin_bit_mask = (1ULL << pin),
            .mode = (gpio_mode_t)mode,
            .pull_up_en = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE,
        };
        gpio_config(&conf);
    }

    void digitalWrite(uint32_t pin, uint32_t value) override {
        if (pin == RADIOLIB_NC) {
            return;
        }
        gpio_set_level((gpio_num_t)pin, value);
    }

    uint32_t digitalRead(uint32_t pin) override {
        if (pin == RADIOLIB_NC) {
            return 0;
        }
        return gpio_get_level((gpio_num_t)pin);
    }

    void attachInterrupt(uint32_t interruptNum, void (*interruptCb)(void),
                         uint32_t mode) override {
        if (interruptNum == RADIOLIB_NC) {
            return;
        }
        gpio_install_isr_service((int)ESP_INTR_FLAG_LEVEL1);
        gpio_set_intr_type((gpio_num_t)interruptNum, (gpio_int_type_t)mode);
        /* RadioLib callbacks take no args, which is ABI-compatible with the
         * gpio_isr_t signature on the platforms RadioLib supports. */
        gpio_isr_handler_add((gpio_num_t)interruptNum, (gpio_isr_t)interruptCb, NULL);
    }

    void detachInterrupt(uint32_t interruptNum) override {
        if (interruptNum == RADIOLIB_NC) {
            return;
        }
        gpio_isr_handler_remove((gpio_num_t)interruptNum);
        gpio_wakeup_disable((gpio_num_t)interruptNum);
        gpio_set_intr_type((gpio_num_t)interruptNum, GPIO_INTR_DISABLE);
    }

    void delay(unsigned long ms) override { vTaskDelay(ms / portTICK_PERIOD_MS); }
    void delayMicroseconds(unsigned long us) override { esp_rom_delay_us(us); }
    unsigned long millis() override { return (unsigned long)(esp_timer_get_time() / 1000ULL); }
    unsigned long micros() override { return (unsigned long)(esp_timer_get_time()); }

    long pulseIn(uint32_t pin, uint32_t state, unsigned long timeout) override {
        if (pin == RADIOLIB_NC) {
            return 0;
        }
        this->pinMode(pin, GPIO_MODE_INPUT);
        uint32_t start = this->micros();
        uint32_t curtick = this->micros();
        while (this->digitalRead(pin) == state) {
            if ((this->micros() - curtick) > timeout) {
                return 0;
            }
        }
        return (this->micros() - start);
    }

    void spiBegin() {
        spi_bus_config_t buscfg = {
            .mosi_io_num = spiMOSI,
            .miso_io_num = spiMISO,
            .sclk_io_num = spiSCK,
            .quadwp_io_num = -1,
            .quadhd_io_num = -1,
            .max_transfer_sz = 0,
        };
        spi_bus_initialize(AQ_LORA_SPI_HOST, &buscfg, SPI_DMA_DISABLED);

        spi_device_interface_config_t devcfg = {
            .mode = 0,
            .clock_speed_hz = AQ_LORA_SPI_HZ,
            .spics_io_num = -1, /* CS handled manually by RadioLib */
            .queue_size = 1,
        };
        spi_bus_add_device(AQ_LORA_SPI_HOST, &devcfg, &spiHandle);
    }

    void spiBeginTransaction() {}

    void spiTransfer(uint8_t *out, size_t len, uint8_t *in) {
        spi_transaction_t t = {};
        t.length = len * 8; /* bits */
        t.rxlength = len * 8;
        t.tx_buffer = out;
        t.rx_buffer = in;
        spi_device_transmit(spiHandle, &t);
    }

    void spiEndTransaction() {}

    void spiEnd() {
        spi_bus_remove_device(spiHandle);
        spi_bus_free(AQ_LORA_SPI_HOST);
    }

  private:
    int8_t spiSCK;
    int8_t spiMISO;
    int8_t spiMOSI;
    spi_device_handle_t spiHandle = NULL;
};

#endif /* AQ_ESP_HAL_H */
