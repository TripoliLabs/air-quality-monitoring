/**
 * ESP32 LoRaWAN adapter (on-target). Transmits the encoded 13-byte payload as a
 * LoRaWAN uplink via the SX1276 radio on the LILYGO T-Beam V1.2 (EU868, OTAA).
 *
 * Implemented with RadioLib (https://github.com/jgromes/RadioLib), which drives
 * the SX1276 and runs the LoRaWAN MAC (OTAA join → session keys → Unconfirmed
 * Data Up). RadioLib is C++, so this file is .cpp; it exposes the C symbol
 * `lorawan_send_payload()` that main.cpp / core call.
 *
 * BUILD GUARD: the real implementation is compiled only when RadioLib's header
 * is on the include path (PlatformIO `lib_deps`, or an ESP-IDF managed
 * component). When it is NOT present — e.g. the lean `firmware-esp32-build.sh`
 * CMake build that only exercises core + sensors — the file falls back to a
 * stub that logs and returns an error, so neither build breaks. The supported
 * LoRaWAN build path is PlatformIO (`pio run -e tbeam-v12`).
 *
 * !! HARDWARE VERIFICATION REQUIRED !!  Radio pin map, EU868 sub-band, and the
 * exact RadioLib LoRaWAN API (it has shifted across 6.x) must be verified
 * against the pinned RadioLib version and the physical board before flashing.
 *
 * SECURITY: DevEUI / JoinEUI / AppKey / NwkKey are compile-time config and
 * default to clearly-fake all-zero placeholders. Real keys are injected at
 * build/flash time (e.g. -DAQ_LORAWAN_APP_KEY_BYTES=... or a private header) and
 * MUST NEVER be committed (see CLAUDE.md "Never commit ... LoRaWAN keys").
 */
#include <stdint.h>

#include "esp_log.h"

static const char *TAG = "lorawan";

extern "C" int lorawan_send_payload(const uint8_t *data, uint8_t len);

/* ----------------------------------------------------------------------------
 * LoRaWAN OTAA credentials (compile-time). PLACEHOLDERS — override at build time.
 * --------------------------------------------------------------------------*/
#ifndef AQ_LORAWAN_JOIN_EUI
#define AQ_LORAWAN_JOIN_EUI 0x0000000000000000ULL /* a.k.a. AppEUI */
#endif
#ifndef AQ_LORAWAN_DEV_EUI
#define AQ_LORAWAN_DEV_EUI 0x0000000000000000ULL
#endif
/* 16-byte AES keys as brace-init byte lists. */
#ifndef AQ_LORAWAN_APP_KEY_BYTES
#define AQ_LORAWAN_APP_KEY_BYTES                                                                    \
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }
#endif
/* NwkKey is only used for LoRaWAN 1.1; for 1.0.x (this project, see CLAUDE.md)
 * it is ignored — default it to the AppKey value. */
#ifndef AQ_LORAWAN_NWK_KEY_BYTES
#define AQ_LORAWAN_NWK_KEY_BYTES AQ_LORAWAN_APP_KEY_BYTES
#endif

#if defined(__has_include)
#if __has_include(<RadioLib.h>)
#define AQ_HAVE_RADIOLIB 1
#endif
#endif

#ifdef AQ_HAVE_RADIOLIB
/* ===========================  REAL IMPLEMENTATION  ========================= */
#include <RadioLib.h>
#include <string.h>

#include "EspHal.h"
#include "esp_attr.h" /* RTC_DATA_ATTR */

/* SX1276 radio pin map for the T-Beam V1.x — CONFIRM ON HARDWARE. */
#ifndef AQ_LORA_PIN_SCK
#define AQ_LORA_PIN_SCK 5
#endif
#ifndef AQ_LORA_PIN_MISO
#define AQ_LORA_PIN_MISO 19
#endif
#ifndef AQ_LORA_PIN_MOSI
#define AQ_LORA_PIN_MOSI 27
#endif
#ifndef AQ_LORA_PIN_CS
#define AQ_LORA_PIN_CS 18
#endif
#ifndef AQ_LORA_PIN_RST
#define AQ_LORA_PIN_RST 23
#endif
#ifndef AQ_LORA_PIN_DIO0
#define AQ_LORA_PIN_DIO0 26
#endif
#ifndef AQ_LORA_PIN_DIO1
#define AQ_LORA_PIN_DIO1 33
#endif

/* HAL + radio + LoRaWAN node. Constructed once (static). */
static EspHal s_hal(AQ_LORA_PIN_SCK, AQ_LORA_PIN_MISO, AQ_LORA_PIN_MOSI);
static SX1276 s_radio =
    new Module(&s_hal, AQ_LORA_PIN_CS, AQ_LORA_PIN_DIO0, AQ_LORA_PIN_RST, AQ_LORA_PIN_DIO1);
static LoRaWANNode s_node(&s_radio, &EU868);

/* LoRaWAN state persisted across deep sleep in RTC RAM, so we do NOT re-join on
 * every 5-minute wake. A fresh OTAA join per wake is 288 joins/day/device —
 * violating join-backoff, churning DevNonces (risking a network-side reject),
 * and wasting the solar budget on join RX windows. The *nonces* buffer carries
 * the monotonic DevNonce; the *session* buffer carries the derived keys + frame
 * counters. Both survive deep sleep in RTC RAM (lost only on a full power cut,
 * after which a fresh join is correct). RTC RAM is limited — these buffers are a
 * few hundred bytes, well within budget.
 *
 * API NOTE: the getBufferNonces / getBufferSession (and setBuffer...) persistence
 * calls and the RADIOLIB_LORAWAN_..._BUF_SIZE sizes are the RadioLib 6.x LoRaWAN
 * API, matching the 6.6.0 pin. Verify against the pinned version before flashing. */
RTC_DATA_ATTR static uint8_t s_nonces[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
RTC_DATA_ATTR static uint8_t s_session[RADIOLIB_LORAWAN_SESSION_BUF_SIZE];
RTC_DATA_ATTR static bool s_have_nonces = false;
RTC_DATA_ATTR static bool s_have_session = false;

static bool s_joined = false;

/* Snapshot the current nonces + session into RTC RAM. */
static void lorawan_save_state(void) {
    memcpy(s_nonces, s_node.getBufferNonces(), RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
    s_have_nonces = true;
    memcpy(s_session, s_node.getBufferSession(), RADIOLIB_LORAWAN_SESSION_BUF_SIZE);
    s_have_session = true;
}

/* Restore a persisted session if we have one, else perform a fresh OTAA join. */
static int lorawan_join(void) {
    uint64_t joinEUI = AQ_LORAWAN_JOIN_EUI;
    uint64_t devEUI = AQ_LORAWAN_DEV_EUI;
    uint8_t appKey[16] = AQ_LORAWAN_APP_KEY_BYTES;
    uint8_t nwkKey[16] = AQ_LORAWAN_NWK_KEY_BYTES;

    ESP_LOGI(TAG, "initializing SX1276 radio");
    int16_t state = s_radio.begin();
    if (state != RADIOLIB_ERR_NONE) {
        ESP_LOGE(TAG, "radio.begin() failed: %d", state);
        return -1;
    }

    s_node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
    /* Feed back the persisted DevNonce counter + session so activateOTAA() can
     * resume instead of re-joining. */
    if (s_have_nonces) {
        s_node.setBufferNonces(s_nonces);
    }
    if (s_have_session) {
        s_node.setBufferSession(s_session);
    }

    state = s_node.activateOTAA();
    if (state != RADIOLIB_LORAWAN_NEW_SESSION && state != RADIOLIB_LORAWAN_SESSION_RESTORED) {
        ESP_LOGE(TAG, "OTAA join failed: %d", state);
        return -1;
    }
    if (state == RADIOLIB_LORAWAN_NEW_SESSION) {
        ESP_LOGI(TAG, "new OTAA join");
        lorawan_save_state(); /* persist the new DevNonce immediately */
    } else {
        ESP_LOGI(TAG, "LoRaWAN session restored — re-join skipped");
    }
    s_joined = true;
    return 0;
}

extern "C" int lorawan_send_payload(const uint8_t *data, uint8_t len) {
    if (!s_joined) {
        if (lorawan_join() != 0) {
            return -1;
        }
    }
    /* Unconfirmed Data Up on fPort 2 (isConfirmed defaults to false). */
    const uint8_t fPort = 2;
    int16_t state = s_node.sendReceive(const_cast<uint8_t *>(data), len, fPort);
    if (state < RADIOLIB_ERR_NONE) {
        ESP_LOGE(TAG, "uplink failed: %d", state);
        return -1;
    }
    /* Persist the advanced frame counters so the next wake resumes cleanly. */
    lorawan_save_state();
    ESP_LOGI(TAG, "uplink sent on fPort %u (%u bytes)", fPort, len);
    return 0;
}

#else /* !AQ_HAVE_RADIOLIB */
/* =============================  FALLBACK STUB  ============================= */
/* RadioLib is not on the include path (lean CMake build). Keep the symbol so the
 * firmware links and runs end-to-end except for the real RF hop. */
extern "C" int lorawan_send_payload(const uint8_t *data, uint8_t len) {
    (void)data;
    ESP_LOGW(TAG,
             "LoRaWAN not compiled in (RadioLib absent) — dropping %u-byte uplink. "
             "Build with PlatformIO (lib_deps RadioLib) for real transmission.",
             len);
    return -1;
}
#endif /* AQ_HAVE_RADIOLIB */
