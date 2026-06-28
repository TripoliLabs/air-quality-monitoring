#ifndef AQ_READING_H
#define AQ_READING_H

#include <stdint.h>

/** A single environmental sample collected by a node. */
typedef struct {
    float pm25;        /* µg/m³ */
    float pm10;        /* µg/m³ */
    float temperature; /* °C */
    float humidity;    /* %RH */
    float pressure;    /* hPa */
    uint16_t battery_mv;
} aq_reading_t;

#endif /* AQ_READING_H */
