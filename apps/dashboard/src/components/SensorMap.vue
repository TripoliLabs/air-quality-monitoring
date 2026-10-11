<script setup lang="ts">
/**
 * The sensor map.
 *
 * Sensors are drawn as map layers fed from one GeoJSON source, so a live
 * reading is a cheap `setData` and the map stays smooth with hundreds of
 * sensors. Which measurement colours the dots comes from the metric registry;
 * the basemap follows the theme, and its place labels follow the language.
 */
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
// MapLibre 6 ships its worker as a separate module. Handing it the bundled URL
// keeps the worker same-origin and working under Vite in dev and in the build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { useTheme } from '../composables/usePrefs';
import { AQI_CATEGORIES, AQI_UNKNOWN } from '../lib/aqi';
import { config } from '../lib/config';
import { METRIC_ORDER, METRICS, type MetricId } from '../lib/metrics';
import { TRIPOLI_CENTER } from '../lib/places';
import type { SensorRow } from '../lib/stats';
import type { Reading } from '../types';
import AppIcon from './AppIcon.vue';
import AqiChip from './AqiChip.vue';
import SegmentedControl from './SegmentedControl.vue';
import StatusLabel from './StatusLabel.vue';

const props = withDefaults(
  defineProps<{
    rows: SensorRow[];
    /** The reading that just arrived live; its sensor ripples once. */
    pulse?: Reading | null;
    /** Highlight one sensor and keep the view on it. */
    focusId?: string;
    /** Hide the layer switcher and the selection card (small location maps). */
    compact?: boolean;
  }>(),
  { pulse: null, focusId: undefined, compact: false },
);

const { t, locale, n, metricValue, metricUnit, sensorName, sensorPlace } = useLocale();
const { theme, isDark } = useTheme();
const aqi = useAqi();

setWorkerUrl(workerUrl);

const SOURCE = 'sensors';
const container = ref<HTMLDivElement | null>(null);
const map = shallowRef<MapLibreMap | null>(null);
const failed = ref(false);
const metric = ref<MetricId>('aqi');
const selectedId = ref<string | null>(null);
let fitted = false;
let styleReady = false;

const metricOptions = computed(() =>
  METRIC_ORDER.map((id) => ({ value: id, label: t(`metrics.${id}.short`) })),
);
const selected = computed(
  () => props.rows.find((row) => row.sensor.id === selectedId.value) ?? null,
);

/** Dark text on light fills, light text on dark fills. */
function readableOn(hex: string): string {
  const v = Number.parseInt(hex.slice(1), 16);
  const luminance =
    (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
  return luminance > 0.55 ? '#0C2231' : '#FFFFFF';
}

type SensorFeatures = Parameters<GeoJSONSource['setData']>[0];

const features = computed((): SensorFeatures => {
  const def = METRICS[metric.value];
  return {
    type: 'FeatureCollection' as const,
    features: props.rows.map((row) => {
      const live = row.status === 'online' && row.reading;
      const value = live ? def.value(row.reading as Reading) : undefined;
      const color = value === undefined ? AQI_UNKNOWN.solid : def.color(value);
      return {
        type: 'Feature' as const,
        id: row.sensor.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.sensor.longitude, row.sensor.latitude],
        },
        properties: {
          id: row.sensor.id,
          live: Boolean(live),
          color,
          ink: readableOn(color),
          label: value === undefined ? '' : n(value, 0),
          // Worst air drawn last, so it is never hidden under a cleaner neighbour.
          rank: value ?? -1,
          focus: row.sensor.id === (props.focusId ?? selectedId.value),
        },
      };
    }),
  };
});

/** Basemap labels in the reader's script; the style ships both. */
function localiseLabels(m: MapLibreMap): void {
  const name: ExpressionSpecification =
    locale.value === 'ar'
      ? ['coalesce', ['get', 'name:ar'], ['get', 'name:nonlatin'], ['get', 'name']]
      : [
          'coalesce',
          ['get', 'name:en'],
          ['get', 'name_en'],
          ['get', 'name:latin'],
          ['get', 'name'],
        ];
  for (const layer of m.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || layer.source === SOURCE) continue;
    const field = JSON.stringify(layer.layout?.['text-field'] ?? '');
    if (field.includes('name')) m.setLayoutProperty(layer.id, 'text-field', name);
  }
}

function addSensorLayers(m: MapLibreMap): void {
  const halo = isDark.value ? '#07161F' : '#FFFFFF';
  m.addSource(SOURCE, { type: 'geojson', data: features.value, promoteId: 'id' });

  m.addLayer({
    id: 'sensor-focus',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'focus'], true],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 13, 15, 24],
      'circle-color': 'transparent',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': isDark.value ? '#E9F2F7' : '#0C2231',
    },
  });
  m.addLayer({
    id: 'sensor-dots',
    type: 'circle',
    source: SOURCE,
    layout: { 'circle-sort-key': ['get', 'rank'] },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 12.5, 9, 15, 16],
      // Sensors that are not reporting are hollow, not just grey.
      'circle-color': ['case', ['get', 'live'], ['get', 'color'], halo],
      'circle-stroke-width': ['case', ['get', 'live'], 2, 2.5],
      'circle-stroke-color': ['case', ['get', 'live'], halo, AQI_UNKNOWN.solid],
    },
  });
  m.addLayer({
    id: 'sensor-values',
    type: 'symbol',
    source: SOURCE,
    minzoom: 12.2,
    filter: ['==', ['get', 'live'], true],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12.2, 9, 15, 13],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': ['get', 'ink'] },
  });
}

function onStyleReady(m: MapLibreMap): void {
  styleReady = true;
  localiseLabels(m);
  if (!m.getSource(SOURCE)) addSensorLayers(m);
  fitToSensors(m);
}

function fitToSensors(m: MapLibreMap): void {
  if (props.focusId) {
    const row = props.rows.find((r) => r.sensor.id === props.focusId);
    if (row) m.jumpTo({ center: [row.sensor.longitude, row.sensor.latitude], zoom: 14.5 });
    return;
  }
  if (fitted || props.rows.length === 0) return;
  fitted = true;
  const bounds = new LngLatBounds();
  for (const row of props.rows) bounds.extend([row.sensor.longitude, row.sensor.latitude]);
  m.fitBounds(bounds, { padding: 56, maxZoom: 14.5, duration: 0 });
}

function ripple(reading: Reading): void {
  const m = map.value;
  const row = props.rows.find((r) => r.sensor.id === reading.sensorId);
  if (!m || !row || document.visibilityState !== 'visible') return;
  // MapLibre positions the marker element with a transform, so the animated
  // ring has to be a child of it.
  const el = document.createElement('div');
  const ring = document.createElement('div');
  ring.className = 'sensor-ripple';
  ring.style.borderColor = METRICS[metric.value].color(
    METRICS[metric.value].value(reading) ?? reading.aqi,
  );
  el.appendChild(ring);
  const marker = new Marker({ element: el })
    .setLngLat([row.sensor.longitude, row.sensor.latitude])
    .addTo(m);
  setTimeout(() => marker.remove(), 1500);
}

onMounted(() => {
  if (!container.value) return;
  let m: MapLibreMap;
  try {
    m = new MapLibreMap({
      container: container.value,
      style: config.mapStyle[theme.value],
      center: [TRIPOLI_CENTER.longitude, TRIPOLI_CENTER.latitude],
      zoom: TRIPOLI_CENTER.zoom,
      minZoom: 9,
      maxZoom: 17,
      attributionControl: { compact: true },
      // On a phone, one finger scrolls the page and two move the map.
      cooperativeGestures: true,
      interactive: !props.compact,
    });
  } catch {
    failed.value = true; // no WebGL
    return;
  }
  map.value = m;

  if (!props.compact) {
    m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  }
  m.on('style.load', () => onStyleReady(m));
  m.on('error', (event) => {
    // A failed basemap leaves an empty canvas; say so instead.
    if (!styleReady && /style|fetch|network/i.test(String(event.error?.message)))
      failed.value = true;
  });

  if (!props.compact) {
    m.on('click', 'sensor-dots', (event) => {
      selectedId.value = String(event.features?.[0]?.properties?.id ?? '') || null;
    });
    m.on('click', (event) => {
      const hit = m.queryRenderedFeatures(event.point, { layers: ['sensor-dots'] });
      if (hit.length === 0) selectedId.value = null;
    });
    m.on('mouseenter', 'sensor-dots', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'sensor-dots', () => (m.getCanvas().style.cursor = ''));
  }
});

watch(features, (data) => {
  const m = map.value;
  if (!m || !styleReady) return;
  (m.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data);
  fitToSensors(m);
});

watch(theme, (value) => {
  styleReady = false;
  map.value?.setStyle(config.mapStyle[value]);
});

watch(locale, () => {
  if (map.value && styleReady) localiseLabels(map.value);
});

watch(
  () => props.pulse,
  (reading) => {
    if (reading) ripple(reading);
  },
);

watch(
  () => props.focusId,
  () => {
    if (map.value && styleReady) fitToSensors(map.value);
  },
);

onBeforeUnmount(() => map.value?.remove());

const legend = computed(() => {
  const def = METRICS[metric.value];
  if (metric.value === 'aqi') return null;
  const [min, max] = def.range;
  const stops = Array.from({ length: 9 }, (_, i) => def.color(min + ((max - min) * i) / 8));
  return { min, max, gradient: `linear-gradient(90deg, ${stops.join(', ')})` };
});
</script>

<template>
  <div class="relative isolate overflow-hidden rounded-panel border bg-sunken">
    <div ref="container" class="h-full w-full" role="application" :aria-label="t('map.label')" />

    <p
      v-if="failed"
      class="absolute inset-0 z-10 flex items-center justify-center bg-sunken p-6 text-center text-sm text-ink-2"
    >
      {{ t('map.unavailable') }}
    </p>

    <template v-if="!compact && !failed">
      <!-- What the dots show -->
      <div class="absolute inset-x-3 top-3 z-10 flex">
        <SegmentedControl
          v-model="metric"
          :options="metricOptions"
          :label="t('map.show')"
          class="shadow-[0_6px_20px_-8px_rgb(7_22_31/0.4)]"
        />
      </div>

      <!-- Legend -->
      <div
        class="absolute start-3 bottom-3 z-10 max-w-[calc(100%-5rem)] rounded-control border bg-surface/92 px-3 py-2 text-xs backdrop-blur-sm"
        :class="{ 'max-sm:hidden': selected }"
      >
        <div v-if="!legend" class="flex items-center gap-2" dir="ltr">
          <span
            v-for="category in AQI_CATEGORIES"
            :key="category.id"
            class="num flex size-5 items-center justify-center rounded-full text-[0.625rem] font-semibold"
            :style="{ backgroundColor: category.solid, color: category.onSolid }"
            :title="`${t(`aqi.names.${category.id}`)} (${category.min}–${category.max})`"
          >
            {{ category.level }}
          </span>
        </div>
        <div v-else class="flex items-center gap-2" dir="ltr">
          <span class="num text-ink-2">{{ n(legend.min) }}</span>
          <span class="h-2 w-24 rounded-full sm:w-32" :style="{ background: legend.gradient }" />
          <span class="num text-ink-2">{{ n(legend.max) }} {{ metricUnit(metric) }}</span>
        </div>
        <div class="mt-1.5 flex items-center gap-1.5 text-ink-2">
          <span class="inline-block size-3 rounded-full border-2 border-ink-3 bg-surface" />
          {{ t('map.notReporting') }}
        </div>
      </div>

      <!-- The selected sensor -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-3 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-3 opacity-0"
      >
        <div
          v-if="selected"
          class="absolute inset-x-3 bottom-3 z-20 rounded-panel border bg-raised p-4 shadow-[0_16px_40px_-16px_rgb(7_22_31/0.5)] sm:inset-x-auto sm:end-14 sm:w-80"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium">{{ sensorName(selected.sensor) }}</p>
              <p class="truncate text-sm text-ink-2">{{ sensorPlace(selected.sensor) }}</p>
            </div>
            <button
              type="button"
              class="-m-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-sunken"
              :aria-label="t('states.close')"
              @click="selectedId = null"
            >
              <AppIcon name="close" />
            </button>
          </div>

          <div v-if="selected.reading" class="mt-3 flex items-center gap-3">
            <AqiChip :aqi="selected.reading.aqi" :stale="selected.status !== 'online'" size="lg" />
            <div class="min-w-0 text-sm">
              <p
                v-if="selected.status === 'online'"
                class="font-medium"
                :style="{ color: aqi.text(selected.reading.aqi) }"
              >
                {{ aqi.name(selected.reading.aqi) }}
              </p>
              <StatusLabel v-else :status="selected.status" />
              <p class="text-ink-2">
                {{ t('metrics.pm25.short') }}
                <span class="num">{{ metricValue('pm25', selected.reading.pm25) }}</span>
                {{ metricUnit('pm25') }}
              </p>
            </div>
          </div>
          <StatusLabel v-else class="mt-3" :status="selected.status" />

          <RouterLink
            :to="{ name: 'sensor', params: { id: selected.sensor.id } }"
            class="btn btn-primary mt-4 w-full"
          >
            {{ t('map.open') }}
            <AppIcon name="chevron" directional />
          </RouterLink>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style>
.sensor-ripple {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid;
  pointer-events: none;
  animation: pulse-ring 1.4s var(--ease-out-soft) forwards;
}
</style>
