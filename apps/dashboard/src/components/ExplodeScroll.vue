<script setup lang="ts">
/**
 * Something opening into its parts as the reader scrolls: frames rendered from a
 * 3D model (hardware/render/node.py) are scrubbed on a canvas, and each part's
 * label follows it once it is open. The frames are transparent, so one set
 * serves both themes.
 *
 * Kept cheap: no animation library, nothing is fetched until the section is a
 * screen away, frames load coarse-to-fine (every 8th first), and drawing only
 * happens on scroll. With "reduce motion" it is shown open, without scrubbing.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '../composables/useLocale';

const props = withDefaults(
  defineProps<{
    /** Frame URLs, closed to open. */
    frames: string[];
    /** Each part's [x, y] in every frame, 0 to 1 across the picture. */
    track: Record<string, number[][]>;
    /** Which column each part's label sits in; the keys are the parts. */
    sides: Record<string, 'l' | 'r'>;
    /** Message prefix: `${messages}.label`, `.hint`, `.steps.<id>.*`, `.parts.<id>`. */
    messages: string;
    steps: string[];
    title: string;
    titleId: string;
    /** Picture width / height. */
    aspect?: number;
  }>(),
  { aspect: 1 },
);

const { t } = useLocale();

const LAST = props.frames.length - 1;
const PARTS = Object.keys(props.sides);
const STEP_EDGES = [0.34, 0.67];

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** 0 = closed, 1 = fully open. */
const open = ref(reduced ? 1 : 0);
const frame = computed(() => Math.round(open.value * LAST));
const step = computed(() => STEP_EDGES.filter((edge) => open.value >= edge).length);
const labelsShown = computed(() => open.value > 0.86);

const images: (HTMLImageElement | null)[] = props.frames.map(() => null);
let loading = false;
let observer: IntersectionObserver | null = null;
let raf = 0;
let drawn = -1;

function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function loadAll(): void {
  if (loading) return;
  loading = true;
  // Coarse to fine: the ends, then every 8th frame, then the gaps.
  const order: number[] = [0, LAST];
  for (const stride of [8, 4, 2, 1]) {
    for (let i = 0; i <= LAST; i += stride) if (!order.includes(i)) order.push(i);
  }
  for (const i of order) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images[i] = img;
      if (Math.abs(i - frame.value) <= 8) draw(true);
    };
    img.src = props.frames[i];
  }
}

/** The nearest frame that has loaded. */
function nearest(i: number): HTMLImageElement | null {
  for (let d = 0; d <= LAST; d++) {
    const a = images[i - d];
    if (a) return a;
    const b = images[i + d];
    if (b) return b;
  }
  return null;
}

function draw(force = false): void {
  const el = canvas.value;
  if (!el) return;
  const i = frame.value;
  if (i === drawn && !force) return;
  const img = nearest(i);
  if (!img) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(el.clientWidth * dpr);
  const h = Math.round(el.clientHeight * dpr);
  if (el.width !== w || el.height !== h) {
    el.width = w;
    el.height = h;
  }
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  drawn = images[i] ? i : -1;
}

function measure(): void {
  raf = 0;
  const el = root.value;
  if (!el || reduced) return;
  const rect = el.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  const p = travel > 0 ? -rect.top / travel : 0;
  // Hold closed for a moment, open over most of the scroll, hold open at the end.
  open.value = smooth((p - 0.08) / 0.78);
  draw();
}

function onScroll(): void {
  if (!raf) raf = requestAnimationFrame(measure);
}

function onResize(): void {
  drawn = -1;
  onScroll();
}

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        loadAll();
        observer?.disconnect();
      }
    },
    { rootMargin: '100% 0px' },
  );
  if (root.value) observer.observe(root.value);
  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  onScroll();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (raf) cancelAnimationFrame(raf);
});

const GAP = 0.075;

/** Label positions: each column keeps the parts' order, pushed apart so none overlap. */
const placed = computed(() => {
  const out: {
    part: string;
    ax: number;
    ay: number;
    y: number;
    side: 'l' | 'r';
  }[] = [];
  for (const side of ['l', 'r'] as const) {
    let prev = -1;
    PARTS.filter((part) => props.sides[part] === side)
      .map((part) => {
        const [ax, ay] = props.track[part][frame.value];
        return { part, ax, ay };
      })
      .sort((a, b) => a.ay - b.ay)
      .forEach((p) => {
        const y = Math.max(p.ay, prev + GAP);
        prev = y;
        out.push({ ...p, y, side });
      });
  }
  return out;
});
</script>

<template>
  <div ref="root" :class="reduced ? '' : 'h-[260vh]'">
    <div
      class="grid items-center gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
      :class="
        reduced
          ? ''
          : 'sticky top-14 h-[calc(100dvh-7.5rem)] content-center sm:top-16 sm:h-[calc(100dvh-4rem)]'
      "
    >
      <div
        class="relative mx-auto w-full max-w-[min(36rem,calc(52dvh*var(--aspect)))] rounded-sky bg-sunken lg:max-w-[min(36rem,calc(74dvh*var(--aspect)))]"
        :style="{ aspectRatio: String(aspect), '--aspect': String(aspect) }"
        role="img"
        :aria-label="t(`${messages}.label`)"
      >
        <canvas ref="canvas" class="absolute inset-0 size-full" />
        <div
          class="pointer-events-none absolute inset-0 transition-opacity duration-300"
          :class="labelsShown ? 'opacity-100' : 'opacity-0'"
          dir="ltr"
          aria-hidden="true"
        >
          <svg class="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              v-for="p in placed"
              :key="p.part"
              :points="`${p.ax * 100},${p.ay * 100} ${p.side === 'l' ? 27 : 73},${p.y * 100} ${p.side === 'l' ? 23 : 77},${p.y * 100}`"
              fill="none"
              class="stroke-brand"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <span
            v-for="p in placed"
            :key="p.part"
            class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-surface"
            :style="{ left: `${p.ax * 100}%`, top: `${p.ay * 100}%` }"
          />
          <span
            v-for="p in placed"
            :key="`${p.part}-label`"
            class="absolute -translate-y-1/2 rounded-full border bg-surface/95 px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-ink shadow-sm sm:text-xs"
            :class="p.side === 'l' ? '-translate-x-full' : ''"
            :style="{ left: p.side === 'l' ? '23%' : '77%', top: `${p.y * 100}%` }"
            >{{ t(`${messages}.parts.${p.part}`) }}</span
          >
        </div>
      </div>

      <div>
        <h2 :id="titleId" class="text-xl sm:text-2xl">{{ title }}</h2>
        <ol class="mt-2 space-y-1 sm:mt-4">
          <li
            v-for="(id, i) in steps"
            :key="id"
            class="border-s-2 py-2 ps-4 transition-colors duration-300"
            :class="step === i || reduced ? 'border-brand' : 'border-line opacity-55 max-lg:hidden'"
          >
            <h3 class="font-medium">{{ t(`${messages}.steps.${id}.title`) }}</h3>
            <p class="mt-0.5 text-[0.9375rem] text-ink-2">
              {{ t(`${messages}.steps.${id}.body`) }}
            </p>
          </li>
        </ol>
        <p v-if="!reduced" class="mt-4 hidden text-sm text-ink-3 lg:block">
          {{ t(`${messages}.hint`) }}
        </p>
      </div>
    </div>
  </div>
</template>
