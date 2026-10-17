<script setup lang="ts">
/**
 * The one time-series chart used across the dashboard, so every chart shares
 * the same axes, tooltip and colour rules. AQI and particle lines are coloured
 * by the AQI band they pass through; other measurements use the brand colour.
 * It re-themes itself when the theme or language changes, and a series that is
 * appended to (a live reading) redraws in place.
 */
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { useTheme } from '../composables/usePrefs';
import { AQI_CATEGORIES, pm25ToAqi } from '../lib/aqi';
import { formatDayTime, intlLocale } from '../lib/format';
import { METRICS, type MetricId } from '../lib/metrics';

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  VisualMapComponent,
]);

export interface ChartPoint {
  time: number;
  value: number;
}

const props = withDefaults(
  defineProps<{
    points: ChartPoint[];
    metric: MetricId;
    /** Span of the x-axis in hours; decides how times are labelled. */
    hours: number;
    /** Accessible description of what the chart shows. */
    label: string;
  }>(),
  {},
);

const { t, locale, metricValue, metricUnit } = useLocale();
const { theme } = useTheme();
const aqi = useAqi();

/** PM2.5 concentrations at which the AQI category changes. */
const PM25_EDGES = [9, 35.4, 55.4, 125.4, 225.4];

const palette = computed(() =>
  theme.value === 'dark'
    ? { ink: '#B0C4D0', faint: '#8CA5B3', line: '#1F3B4A', surface: '#15303F', brand: '#63C7E3' }
    : { ink: '#3D5566', faint: '#526B7A', line: '#D3DEE6', surface: '#FFFFFF', brand: '#0A6788' },
);

const bands = computed(() => {
  if (props.metric === 'aqi') {
    return AQI_CATEGORIES.map((c) => ({ gt: c.min - 1, lte: c.max, color: c.solid }));
  }
  if (props.metric === 'pm25') {
    return AQI_CATEGORIES.map((c, i) => ({
      gt: i === 0 ? -1 : PM25_EDGES[i - 1],
      lte: PM25_EDGES[i] ?? 10_000,
      color: c.solid,
    }));
  }
  return null;
});

const option = computed(() => {
  const p = palette.value;
  const def = METRICS[props.metric];
  const intl = intlLocale(locale.value);
  const axisTime = new Intl.DateTimeFormat(
    intl,
    props.hours <= 48
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { day: 'numeric', month: 'short' },
  );
  const unit = metricUnit(props.metric);
  const zeroBased = props.metric === 'aqi' || props.metric === 'pm25' || props.metric === 'pm10';

  return {
    animationDuration: 350,
    textStyle: { fontFamily: 'Readex Pro Variable, system-ui, sans-serif', color: p.ink },
    grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.surface,
      borderColor: p.line,
      padding: [8, 12],
      textStyle: { color: p.ink, fontSize: 13 },
      axisPointer: { lineStyle: { color: p.faint, type: 'dashed' } },
      formatter: (params: { value: [number, number] }[]): string => {
        const [time, value] = params[0].value;
        const index =
          props.metric === 'aqi' ? value : props.metric === 'pm25' ? pm25ToAqi(value) : null;
        const tone =
          index === null
            ? ''
            : ` <span style="color:${aqi.text(index)}">${aqi.shortName(index)}</span>`;
        return `<div dir="auto"><div style="opacity:.75">${formatDayTime(time, locale.value)}</div>
          <div style="font-weight:600;font-size:15px">${t(`metrics.${props.metric}.short`)} ${metricValue(props.metric, value)} ${unit}${tone}</div></div>`;
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: p.line } },
      axisTick: { show: false },
      axisLabel: {
        color: p.faint,
        fontSize: 11,
        hideOverlap: true,
        formatter: (value: number): string => axisTime.format(value),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: zeroBased ? 0 : (extent: { min: number }): number => Math.floor(extent.min - 1),
      max: (extent: { max: number }): number =>
        zeroBased
          ? Math.max(def.range[1] / 2, Math.ceil(extent.max * 1.15))
          : Math.ceil(extent.max + 1),
      axisLabel: { color: p.faint, fontSize: 11 },
      splitLine: { lineStyle: { color: p.line, type: 'dashed' } },
    },
    visualMap: bands.value
      ? [{ show: false, type: 'piecewise', dimension: 1, seriesIndex: 0, pieces: bands.value }]
      : undefined,
    dataZoom:
      props.points.length > 120 ? [{ type: 'inside', zoomOnMouseWheel: 'ctrl' }] : undefined,
    series: [
      {
        type: 'line',
        data: props.points.map((point) => [point.time, point.value]),
        showSymbol: false,
        smooth: 0.25,
        sampling: 'lttb',
        lineStyle: { width: 2.25 },
        itemStyle: bands.value ? undefined : { color: p.brand },
        areaStyle: { opacity: 0.1 },
        emphasis: { disabled: true },
      },
    ],
  };
});
</script>

<template>
  <!-- Charts keep time running left to right in both languages. -->
  <div dir="ltr" role="img" :aria-label="label" class="h-64 w-full sm:h-80">
    <VChart
      :option="option"
      autoresize
      :update-options="{ notMerge: true }"
      class="h-full w-full"
    />
  </div>
</template>
