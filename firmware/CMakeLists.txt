# ESP-IDF project for the air-quality node (on-target build).
# Build in the official Espressif container (see scripts/firmware-esp32-build.sh):
#   idf.py -B build-esp32 set-target esp32 build
cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(aq-node)
