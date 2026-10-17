<script setup lang="ts">
/**
 * A small AQI trend drawn in SVG (no chart library on the first screen). The
 * line takes the colour of the AQI band it passes through, and the last point —
 * the live value — is marked.
 */
import { computed, useId } from 'vue';
import { AQI_CATEGORIES } from '../lib/aqi';
import type { SeriesPoint } from '../lib/stats';

const props = withDefaults(defineProps<{ points: SeriesPoint[]; height?: number }>(), {
  height: 72,
});

const W = 600;
const PAD = 6;
const gradientId = useId();

const geometry = computed(() => {
  const pts = props.points;
  if (pts.length < 2) return null;
  const values = pts.map((p) => p.aqi);
  // A little headroom, and never a flat line pinned to an edge.
  const lo = Math.max(0, Math.min(...values) - 8);
  const hi = Math.max(...values, lo + 30) + 8;
  const t0 = pts[0].time;
  const span = pts[pts.length - 1].time - t0 || 1;
  const H = props.height;
  const x = (time: number): number => PAD + ((time - t0) / span) * (W - PAD * 2);
  const y = (aqi: number): number => H - PAD - ((aqi - lo) / (hi - lo)) * (H - PAD * 2);

  const coords = pts.map((p) => [x(p.time), y(p.aqi)] as const);
  const line = coords
    .map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx.toFixed(1)},${cy.toFixed(1)}`)
    .join('');
  const area = `${line}L${coords[coords.length - 1][0].toFixed(1)},${H}L${coords[0][0].toFixed(1)},${H}Z`;

  // Vertical gradient with hard stops at the AQI band edges, in user space.
  const stops = AQI_CATEGORIES.flatMap((c) => {
    const top = Math.min(1, Math.max(0, y(c.max + 0.5) / H));
    const bottom = Math.min(1, Math.max(0, y(c.min - 0.5) / H));
    return [
      { offset: top, color: c.solid },
      { offset: bottom, color: c.solid },
    ];
  }).sort((a, b) => a.offset - b.offset);

  return { line, area, stops, end: coords[coords.length - 1], H };
});
</script>

<template>
  <!-- Time runs left to right in both languages, as on a clock face chart. -->
  <svg
    v-if="geometry"
    :viewBox="`0 0 ${W} ${geometry.H}`"
    preserveAspectRatio="none"
    class="block w-full overflow-visible"
    :style="{ height: `${height}px` }"
    dir="ltr"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="gradientId"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="0"
        x2="0"
        :y2="geometry.H"
      >
        <stop
          v-for="(stop, i) in geometry.stops"
          :key="i"
          :offset="stop.offset"
          :stop-color="stop.color"
        />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#${gradientId})`" opacity="0.14" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="`url(#${gradientId})`"
      stroke-width="2.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
    <!-- preserveAspectRatio="none" would squash a <circle>; a zero-length round-capped line stays round. -->
    <path
      :d="`M${geometry.end[0]},${geometry.end[1]}h0.01`"
      stroke="var(--ink)"
      stroke-width="9"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
    <path
      :d="`M${geometry.end[0]},${geometry.end[1]}h0.01`"
      stroke="var(--surface)"
      stroke-width="4"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
