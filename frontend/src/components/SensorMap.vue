<script setup lang="ts">
import { getAqiColor } from '@composables/useAqi';
import { TRIPOLI_CENTER } from '@mock/sensors';
import type { SensorTimeSeries } from '@stores/sensors';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

export type MapLayer = 'aqi' | 'pm25' | 'temperature' | 'humidity';

const props = withDefaults(
  defineProps<{
    sensors: SensorTimeSeries[];
    selectedSensorId?: string;
    height?: string;
    interactive?: boolean;
    center?: { latitude: number; longitude: number };
    zoom?: number;
  }>(),
  {
    height: '500px',
    interactive: true,
    selectedSensorId: undefined,
    center: undefined,
    zoom: undefined,
  },
);

const emit = defineEmits<{
  sensorClick: [sensorId: string];
}>();

const { t, locale } = useI18n();
const mapContainer = ref<HTMLDivElement | null>(null);
const activeLayer = ref<MapLayer>('aqi');
let map: maplibregl.Map | null = null;
const markers: Map<string, maplibregl.Marker> = new Map();

// ── Layer color functions ──

function interpolateColor(
  value: number,
  min: number,
  max: number,
  stops: { pos: number; color: [number, number, number] }[],
): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].pos && t <= stops[i + 1].pos) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = upper.pos - lower.pos || 1;
  const f = (t - lower.pos) / range;
  const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * f);
  const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * f);
  const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * f);
  return `rgb(${r},${g},${b})`;
}

function getPm25Color(pm25: number): string {
  return interpolateColor(pm25, 0, 150, [
    { pos: 0, color: [0, 228, 0] },
    { pos: 0.08, color: [0, 228, 0] },
    { pos: 0.24, color: [255, 255, 0] },
    { pos: 0.37, color: [255, 126, 0] },
    { pos: 0.7, color: [255, 0, 0] },
    { pos: 1, color: [143, 63, 151] },
  ]);
}

function getTempColor(temp: number): string {
  return interpolateColor(temp, 10, 40, [
    { pos: 0, color: [59, 130, 246] },
    { pos: 0.35, color: [34, 197, 94] },
    { pos: 0.65, color: [234, 179, 8] },
    { pos: 1, color: [239, 68, 68] },
  ]);
}

function getHumidityColor(humidity: number): string {
  return interpolateColor(humidity, 20, 90, [
    { pos: 0, color: [194, 120, 62] },
    { pos: 0.5, color: [34, 197, 94] },
    { pos: 1, color: [59, 130, 246] },
  ]);
}

function getColorForSensor(sensor: SensorTimeSeries): string {
  if (!sensor.latest) return '#6b7280';
  switch (activeLayer.value) {
    case 'pm25':
      return getPm25Color(sensor.latest.pm2_5);
    case 'temperature':
      return getTempColor(sensor.latest.temperature);
    case 'humidity':
      return getHumidityColor(sensor.latest.humidity);
    default:
      return getAqiColor(sensor.latest.aqi);
  }
}

function getMetricLabel(sensor: SensorTimeSeries): string {
  if (!sensor.latest) return '--';
  switch (activeLayer.value) {
    case 'pm25':
      return `${sensor.latest.pm2_5.toFixed(1)} µg/m³`;
    case 'temperature':
      return `${sensor.latest.temperature.toFixed(1)}°C`;
    case 'humidity':
      return `${sensor.latest.humidity.toFixed(0)}%`;
    default:
      return `AQI ${sensor.latest.aqi}`;
  }
}

// ── Legend config ──

interface LegendConfig {
  gradient: string;
  min: string;
  max: string;
}

const legendConfig = computed((): LegendConfig => {
  switch (activeLayer.value) {
    case 'pm25':
      return {
        gradient:
          'linear-gradient(to right, #00e400, #ffff00, #ff7e00, #ff0000, #8f3f97)',
        min: '0',
        max: '150 µg/m³',
      };
    case 'temperature':
      return {
        gradient:
          'linear-gradient(to right, #3b82f6, #22c55e, #eab308, #ef4444)',
        min: '10°C',
        max: '40°C',
      };
    case 'humidity':
      return {
        gradient:
          'linear-gradient(to right, #c2783e, #22c55e, #3b82f6)',
        min: '20%',
        max: '90%',
      };
    default:
      return {
        gradient:
          'linear-gradient(to right, #00e400, #ffff00, #ff7e00, #ff0000, #8f3f97, #7e0023)',
        min: '0',
        max: '300+',
      };
  }
});

const layers: { key: MapLayer; labelKey: string }[] = [
  { key: 'aqi', labelKey: 'map.layerAqi' },
  { key: 'pm25', labelKey: 'map.layerPm25' },
  { key: 'temperature', labelKey: 'map.layerTemp' },
  { key: 'humidity', labelKey: 'map.layerHumidity' },
];

// ── Marker creation & updates ──

function createMarkerElement(color: string): HTMLDivElement {
  const outer = document.createElement('div');
  outer.style.cssText = 'width: 22px; height: 22px; cursor: pointer;';

  const dot = document.createElement('div');
  dot.className = 'sensor-dot';
  dot.style.cssText = `
    width: 14px;
    height: 14px;
    margin: 4px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid rgba(255,255,255,0.6);
    box-shadow: 0 0 6px ${color}80, 0 0 12px ${color}30;
    transition: transform 0.2s, box-shadow 0.2s, background 0.3s;
  `;

  outer.addEventListener('mouseenter', () => {
    dot.style.transform = 'scale(1.5)';
    dot.style.boxShadow = `0 0 10px ${dot.style.background}aa, 0 0 20px ${dot.style.background}50`;
  });
  outer.addEventListener('mouseleave', () => {
    dot.style.transform = 'scale(1)';
    const bg = dot.style.background;
    dot.style.boxShadow = `0 0 6px ${bg}80, 0 0 12px ${bg}30`;
  });

  outer.appendChild(dot);
  return outer;
}

function getSensorName(sensor: SensorTimeSeries): string {
  return locale.value === 'ar' ? sensor.definition.nameAr : sensor.definition.name;
}

function getNeighborhood(sensor: SensorTimeSeries): string {
  return locale.value === 'ar'
    ? sensor.definition.location.neighborhoodAr
    : sensor.definition.location.neighborhood;
}

function updateDotColor(dot: HTMLDivElement, color: string): void {
  dot.style.background = color;
  dot.style.boxShadow = `0 0 6px ${color}80, 0 0 12px ${color}30`;
}

function updateMarkers(): void {
  if (!map) return;

  for (const sensor of props.sensors) {
    const { latitude, longitude } = sensor.definition.location;
    const color = getColorForSensor(sensor);
    const existing = markers.get(sensor.definition.id);

    if (existing) {
      const dot = existing.getElement().querySelector('.sensor-dot') as HTMLDivElement | null;
      if (dot) updateDotColor(dot, color);
    } else {
      const el = createMarkerElement(color);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);

      el.addEventListener('click', () => {
        emit('sensorClick', sensor.definition.id);
      });

      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
      });

      el.addEventListener('mouseenter', () => {
        const name = getSensorName(sensor);
        const neighborhood = getNeighborhood(sensor);
        const metric = getMetricLabel(sensor);
        popup
          .setLngLat([longitude, latitude])
          .setHTML(
            `<div style="font-size:13px">
              <strong>${name}</strong>
              <span style="color:#9ca3af;font-size:11px"> ${neighborhood}</span><br/>
              <span><b>${metric}</b></span>
            </div>`,
          )
          .addTo(map!);
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      markers.set(sensor.definition.id, marker);
    }
  }
}

// ── Lifecycle ──

onMounted(() => {
  if (!mapContainer.value) return;

  const mapCenter = props.center ?? TRIPOLI_CENTER;
  const mapZoom = props.zoom ?? TRIPOLI_CENTER.zoom;

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://tiles.openfreemap.org/styles/dark',
    center: [mapCenter.longitude, mapCenter.latitude],
    zoom: mapZoom,
    interactive: props.interactive,
    attributionControl: false,
  });

  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  if (props.interactive) {
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
  }

  map.on('load', () => {
    updateMarkers();
  });
});

watch(
  () => props.sensors.map((s) => [
    s.latest?.aqi,
    s.latest?.pm2_5,
    s.latest?.temperature,
    s.latest?.humidity,
  ]),
  () => updateMarkers(),
  { deep: true },
);

watch(activeLayer, () => updateMarkers());

watch(
  () => props.selectedSensorId,
  (id) => {
    if (!map || !id) return;
    const sensor = props.sensors.find((s) => s.definition.id === id);
    if (sensor) {
      map.flyTo({
        center: [sensor.definition.location.longitude, sensor.definition.location.latitude],
        zoom: 15,
        duration: 1000,
      });
    }
  },
);

onBeforeUnmount(() => {
  markers.forEach((m) => m.remove());
  markers.clear();
  map?.remove();
  map = null;
});
</script>

<template>
  <div
    class="relative overflow-hidden rounded-xl border border-gray-800"
    :style="{ height }"
  >
    <!-- Map canvas -->
    <div ref="mapContainer" class="h-full w-full"></div>

    <!-- Layer toggle (top-left) -->
    <div
      v-if="interactive"
      class="absolute start-3 top-3 z-10 flex rounded-lg border border-gray-700 bg-gray-900/90 backdrop-blur-sm"
    >
      <button
        v-for="layer in layers"
        :key="layer.key"
        class="px-2.5 py-1.5 text-xs font-medium transition-colors"
        :class="
          activeLayer === layer.key
            ? 'bg-emerald-600 text-white'
            : 'text-gray-400 hover:text-gray-200'
        "
        :style="{
          borderRadius:
            layer.key === layers[0].key
              ? '0.45rem 0 0 0.45rem'
              : layer.key === layers[layers.length - 1].key
                ? '0 0.45rem 0.45rem 0'
                : '0',
        }"
        @click="activeLayer = layer.key"
      >
        {{ t(layer.labelKey) }}
      </button>
    </div>

    <!-- Legend (bottom-left) -->
    <div
      v-if="interactive"
      class="absolute bottom-3 start-3 z-10 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur-sm"
    >
      <div
        class="h-2.5 w-36 rounded-full"
        :style="{ background: legendConfig.gradient }"
      ></div>
      <div class="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{{ legendConfig.min }}</span>
        <span>{{ legendConfig.max }}</span>
      </div>
    </div>
  </div>
</template>
