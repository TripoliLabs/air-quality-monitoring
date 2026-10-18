/**
 * NVS-backed config store. Only a config downlink that changes a value writes to
 * flash (aq_state_on_downlink() reports that), so wear is a few writes per
 * change, not one per wake.
 *
 * The record is serialised field by field with its own version byte rather than
 * stored as the raw struct, so a later firmware can read (or knowingly discard)
 * what an older one wrote. The caller range-checks what comes back through
 * aq_state_init(), so a corrupt record falls back to the defaults.
 */
#include "config_store_esp32.h"

#include <stdint.h>

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"

static const char *TAG = "config";

#define NVS_NAMESPACE "aq"
#define NVS_KEY "config"
#define RECORD_VERSION 1
#define RECORD_LEN 7 /* [version][interval u16][pm offset i16][temp offset i16] */

static int ensure_nvs(void) {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        /* The partition is full or from another IDF version: start it afresh. */
        ESP_LOGW(TAG, "erasing NVS (%s)", esp_err_to_name(err));
        if (nvs_flash_erase() != ESP_OK) return -1;
        err = nvs_flash_init();
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_flash_init failed: %s", esp_err_to_name(err));
        return -1;
    }
    return 0;
}

int esp32_config_load(aq_config_t *cfg) {
    if (ensure_nvs() != 0) return -1;
    nvs_handle_t h;
    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &h) != ESP_OK) {
        return -1; /* namespace not created yet: nothing stored */
    }
    uint8_t rec[RECORD_LEN];
    size_t len = sizeof(rec);
    esp_err_t err = nvs_get_blob(h, NVS_KEY, rec, &len);
    nvs_close(h);
    if (err != ESP_OK || len != RECORD_LEN || rec[0] != RECORD_VERSION) {
        if (err != ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "ignoring stored config (%s, %u bytes)", esp_err_to_name(err),
                     (unsigned)len);
        }
        return -1;
    }
    cfg->sample_interval_s = (uint16_t)(rec[1] | (rec[2] << 8));
    cfg->pm_offset_x10 = (int16_t)(rec[3] | (rec[4] << 8));
    cfg->temp_offset_x100 = (int16_t)(rec[5] | (rec[6] << 8));
    return 0;
}

int esp32_config_save(const aq_config_t *cfg) {
    if (ensure_nvs() != 0) return -1;
    const uint16_t pm = (uint16_t)cfg->pm_offset_x10;
    const uint16_t temp = (uint16_t)cfg->temp_offset_x100;
    const uint8_t rec[RECORD_LEN] = {
        RECORD_VERSION,
        (uint8_t)(cfg->sample_interval_s & 0xff), (uint8_t)(cfg->sample_interval_s >> 8),
        (uint8_t)(pm & 0xff), (uint8_t)(pm >> 8),
        (uint8_t)(temp & 0xff), (uint8_t)(temp >> 8),
    };
    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &h);
    if (err == ESP_OK) {
        err = nvs_set_blob(h, NVS_KEY, rec, sizeof(rec));
        if (err == ESP_OK) err = nvs_commit(h);
        nvs_close(h);
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "saving config failed: %s", esp_err_to_name(err));
        return -1;
    }
    return 0;
}
