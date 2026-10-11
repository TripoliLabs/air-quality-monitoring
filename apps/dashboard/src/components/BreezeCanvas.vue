<script setup lang="ts">
/**
 * Moving air — the dashboard's signature.
 *
 * Fine streaks drift across the panel, always from the sea side (left) inland,
 * the way the wind usually blows over Tripoli. The air on the page follows the
 * air in the city: when it is clean the streaks are few, long and quick; as it
 * gets worse they thicken into a slow haze tinted with the AQI colour.
 *
 * It stays out of the way: it never sits behind tables or charts, it stops when
 * off screen or in a background tab, and with "reduce motion" it is one still
 * frame.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 0 = clean air, 1 = hazardous. Null (no data) is drawn as calm, clean air. */
    haze?: number | null;
    /** AQI colour mixed into some of the streaks. */
    tint?: string | null;
    /** Scales the number of streaks; slim page headers use less. */
    density?: number;
  }>(),
  { haze: null, tint: null, density: 1 },
);

interface Streak {
  x: number;
  y: number;
  /** 0 (far, faint, slow) to 1 (near). */
  depth: number;
  phase: number;
  tinted: boolean;
}

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let streaks: Streak[] = [];
let width = 0;
let height = 0;
let frame = 0;
let last = 0;
let clock = 0;
let visible = true;
/** Eased towards props.haze so a change in air quality drifts in. */
let haze = props.haze ?? 0;
let streakRgb = '12 34 49';
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let themeObserver: MutationObserver | null = null;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function targetCount(): number {
  const base = (width * height) / 9000;
  return Math.round(Math.min(150, Math.max(10, base * props.density * (0.55 + haze * 1.5))));
}

function spawn(anywhere: boolean): Streak {
  return {
    x: anywhere ? Math.random() * width : -40,
    y: Math.random() * height,
    depth: Math.random(),
    phase: Math.random() * Math.PI * 2,
    tinted: Math.random() < 0.3,
  };
}

function readTheme(): void {
  if (!canvas.value) return;
  streakRgb = getComputedStyle(canvas.value).getPropertyValue('--streak').trim() || streakRgb;
}

function resize(): void {
  const el = canvas.value;
  if (!el || !ctx) return;
  const rect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  streaks = Array.from({ length: targetCount() }, () => spawn(true));
  draw(0);
}

function draw(dt: number): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';

  haze += ((props.haze ?? 0) - haze) * Math.min(1, dt * 0.8);
  clock += dt;

  // Keep the population in step with the haze without popping.
  const wanted = targetCount();
  if (streaks.length < wanted) streaks.push(spawn(false));
  else if (streaks.length > wanted) streaks.pop();

  const speed = 46 - haze * 30; // px/s for the nearest streaks
  const length = 70 - haze * 62; // long streaks thin out into specks
  const tint = props.tint;

  for (const s of streaks) {
    const near = 0.35 + s.depth * 0.65;
    s.x += speed * near * dt;
    const drift = Math.sin(clock * 0.5 + s.phase) * (4 + haze * 6);
    if (s.x - length > width) {
      s.x = -10;
      s.y = Math.random() * height;
    }

    const y = s.y + drift;
    const len = Math.max(1.5, length * near);
    const alpha = (0.07 + s.depth * 0.16) * (0.75 + haze * 0.9);
    ctx.lineWidth = 0.8 + s.depth * (0.9 + haze * 1.6);
    if (s.tinted && tint && haze > 0.12) {
      ctx.globalAlpha = Math.min(0.7, alpha * 2.2);
      ctx.strokeStyle = tint;
    } else {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgb(${streakRgb} / ${alpha.toFixed(3)})`;
    }
    ctx.beginPath();
    ctx.moveTo(s.x - len, y - Math.sin(clock * 0.5 + s.phase - 0.4) * 1.5);
    ctx.lineTo(s.x, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function tick(time: number): void {
  const dt = Math.min(0.05, (time - last) / 1000 || 0);
  last = time;
  draw(dt);
  frame = requestAnimationFrame(tick);
}

function running(): boolean {
  return visible && document.visibilityState === 'visible' && !reducedMotion.matches;
}

function sync(): void {
  cancelAnimationFrame(frame);
  frame = 0;
  if (running()) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  } else {
    haze = props.haze ?? 0;
    draw(0);
  }
}

onMounted(() => {
  const el = canvas.value;
  if (!el) return;
  ctx = el.getContext('2d');
  readTheme();
  resize();

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(el);
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(el);
  themeObserver = new MutationObserver(() => {
    readTheme();
    if (!frame) draw(0);
  });
  themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  sync();
});

// With motion off there is no loop to pick up a new haze level; redraw once.
watch(
  () => [props.haze, props.tint],
  () => {
    if (!frame) {
      haze = props.haze ?? 0;
      streaks = Array.from({ length: targetCount() }, () => spawn(true));
      draw(0);
    }
  },
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  themeObserver?.disconnect();
  document.removeEventListener('visibilitychange', sync);
  reducedMotion.removeEventListener('change', sync);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="pointer-events-none absolute inset-0 h-full w-full"
    aria-hidden="true"
  />
</template>
