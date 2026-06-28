#!/usr/bin/env bash
#
# Cross-compile the ESP32 firmware locally using the official Espressif ESP-IDF
# Docker image — no local ESP-IDF/toolchain install needed. Verifies the
# on-target build (and should be run in CI on firmware changes).
#
#   scripts/firmware-esp32-build.sh
#
# Output: firmware/build-esp32/aq-node.bin (flash with: idf.py -B build-esp32 flash)
set -euo pipefail

IMAGE="${IDF_IMAGE:-espressif/idf:release-v5.2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Building ESP32 firmware with $IMAGE ..."
docker run --rm -v "$ROOT/firmware":/project -w /project "$IMAGE" \
  idf.py -B build-esp32 set-target esp32 build

echo
echo "✓ Built firmware/build-esp32/aq-node.bin"
