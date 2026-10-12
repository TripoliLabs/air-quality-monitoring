<script setup lang="ts">
/**
 * Moving air — the dashboard's signature.
 *
 * Soft motes ride a wind that blows from the sea side (left) inland, the way it
 * usually does over Tripoli. The wind wanders, gusts pass through, and the
 * pointer stirs the air around it. The air on the page follows the air in the
 * city: when it is clean the motes are few, small and quick; as it gets worse
 * they thicken into a slow haze tinted with the AQI colour.
 *
 * It belongs to the home page only: at full strength in the hero, and as a
 * fainter fixed backdrop behind the rest of that page. It never takes pointer
 * events and it stops when off screen or in a background tab. With "reduce
 * motion" the air still drifts, at half pace and without gusts or the swirl.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 0 = clean air, 1 = hazardous. Null (no data) is drawn as calm, clean air. */
    haze?: number | null;
    /** AQI colour mixed into some of the motes. */
    tint?: string | null;
    /** Scales the number of motes; the backdrop uses less. */
    density?: number;
    /** Fill the viewport behind the page instead of the parent element. */
    backdrop?: boolean;
  }>(),
  { haze: null, tint: null, density: 1, backdrop: false },
);

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 (far, faint, slow) to 1 (near). */
  depth: number;
  size: number;
  alpha: number;
  angle: number;
  wobbleSpeed: number;
  wobble: number;
  tinted: boolean;
}

interface Gust {
  x: number;
  y: number;
  radius: number;
  strength: number;
  direction: number;
  age: number;
  life: number;
}

const MAX_GUSTS = 3;
const POINTER_REACH = 160;
const LINK_REACH = 80;
const EDGE = 20;

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let motes: Mote[] = [];
let gusts: Gust[] = [];
let width = 0;
let height = 0;
let frame = 0;
let last = 0;
let clock = 0;
let visible = true;
/** Eased towards props.haze so a change in air quality drifts in. */
let haze = props.haze ?? 0;
let windAngle = 0;
let windTarget = 0;
let streakRgb = '12 34 49';
/** Dark motes on a light page read heavier than light ones on dark; ease them off. */
let alphaScale = 1;
let glow: HTMLCanvasElement | null = null;
let tintGlow: HTMLCanvasElement | null = null;
let pointerX = 0;
let pointerY = 0;
let pointerUntil = 0;
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let themeObserver: MutationObserver | null = null;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function targetCount(): number {
  const base = (width * height) / 15_000;
  return Math.round(Math.min(140, Math.max(6, base * props.density * (0.7 + haze * 1.3))));
}

function spawn(): Mote {
  const depth = Math.random();
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: 0,
    vy: 0,
    depth,
    size: (0.5 + Math.random() * 2) * (0.5 + depth * 0.5),
    alpha: (0.1 + Math.random() * 0.4) * (0.3 + depth * 0.7),
    angle: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.6 + Math.random() * 1.8,
    wobble: 6 + Math.random() * 16,
    tinted: Math.random() < 0.3,
  };
}

/** A soft round glow in one colour, drawn once and stamped for every mote. */
function sprite(color: string): HTMLCanvasElement {
  const size = 64;
  const el = document.createElement('canvas');
  el.width = el.height = size;
  const c = el.getContext('2d');
  if (!c) return el;
  const gradient = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgb(0 0 0 / 1)');
  gradient.addColorStop(0.4, 'rgb(0 0 0 / 0.45)');
  gradient.addColorStop(1, 'rgb(0 0 0 / 0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, size, size);
  return el;
}

function readTheme(): void {
  if (!canvas.value) return;
  streakRgb = getComputedStyle(canvas.value).getPropertyValue('--streak').trim() || streakRgb;
  const [r, g, b] = streakRgb.split(/\s+/).map(Number);
  alphaScale = (r + g + b) / 3 < 128 ? 0.6 : 1;
  glow = sprite(`rgb(${streakRgb})`);
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
  motes = Array.from({ length: targetCount() }, spawn);
  gusts = [];
  draw(0);
}

function step(dt: number): void {
  // The wind keeps its heading but wanders a little, and breathes in strength.
  if (Math.random() < dt * 0.3) windTarget = (Math.random() - 0.5) * 0.6;
  windAngle += (windTarget - windAngle) * Math.min(1, dt * 0.6);
  const calm = reducedMotion.matches;
  const strength = (100 - haze * 45) * (1 + Math.sin(clock * 0.5) * 0.3) * (calm ? 0.5 : 1);
  const windX = Math.cos(windAngle) * strength;
  const windY = Math.sin(windAngle) * strength * 0.3;

  if (!calm && gusts.length < MAX_GUSTS && Math.random() < dt * 1.2) {
    gusts.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 100 + Math.random() * 200,
      strength: 60 + Math.random() * 120,
      direction: windAngle + (Math.random() - 0.5) * 0.5,
      age: 0,
      life: 1 + Math.random() * 2,
    });
  }
  for (const gust of gusts) gust.age += dt;
  gusts = gusts.filter((gust) => gust.age < gust.life);

  const stirred = !calm && performance.now() < pointerUntil;
  const ease = Math.min(1, dt * 2.4);

  for (const m of motes) {
    const near = 0.4 + m.depth * 0.6;
    m.vx += (windX * near - m.vx) * ease;
    m.vy += (windY * near - m.vy) * ease;

    for (const gust of gusts) {
      const distance = Math.hypot(m.x - gust.x, m.y - gust.y);
      if (distance >= gust.radius) continue;
      const push =
        (1 - distance / gust.radius) * Math.sin((gust.age / gust.life) * Math.PI) * gust.strength;
      m.vx += Math.cos(gust.direction) * push * dt;
      m.vy += Math.sin(gust.direction) * push * 0.5 * dt;
    }

    if (stirred) {
      const dx = m.x - pointerX;
      const dy = m.y - pointerY;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.5 && distance < POINTER_REACH) {
        // A swirl around the pointer, with a slight push outwards.
        const force = (1 - distance / POINTER_REACH) * dt;
        const swirl = Math.atan2(dy, dx) + Math.PI / 2;
        m.vx += Math.cos(swirl) * force * 260 + (dx / distance) * force * 140;
        m.vy += Math.sin(swirl) * force * 260 + (dy / distance) * force * 140;
      }
    }

    m.angle += m.wobbleSpeed * dt;
    m.x += (m.vx + Math.sin(m.angle + m.x * 0.01) * m.wobble) * dt;
    m.y += (m.vy + Math.cos(m.angle * 0.7 + m.y * 0.01) * m.wobble * 0.7) * dt;

    if (m.x > width + EDGE) {
      m.x = -EDGE;
      m.y = Math.random() * height;
    } else if (m.x < -EDGE) m.x = width + EDGE;
    if (m.y > height + EDGE) m.y = -EDGE;
    else if (m.y < -EDGE) m.y = height + EDGE;
  }
}

function draw(dt: number): void {
  if (!ctx || !glow) return;
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';

  haze += ((props.haze ?? 0) - haze) * Math.min(1, dt * 0.8);
  clock += dt;

  // Keep the population in step with the haze without popping.
  const wanted = targetCount();
  if (motes.length < wanted) motes.push({ ...spawn(), x: -EDGE });
  else if (motes.length > wanted) motes.pop();

  if (dt > 0) step(dt);

  const tint = props.tint && haze > 0.12 ? props.tint : null;
  const swell = 1 + haze * 0.9;
  const density = alphaScale * (0.8 + haze * 0.7);

  // Faint threads between neighbours at the same depth: the shape of a current.
  ctx.lineWidth = 0.5;
  for (let i = 0; i < motes.length; i++) {
    const a = motes[i];
    for (let j = i + 1; j < Math.min(i + 6, motes.length); j++) {
      const b = motes[j];
      if (Math.abs(a.depth - b.depth) > 0.3) continue;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance >= LINK_REACH) continue;
      const alpha = 0.09 * (1 - distance / LINK_REACH) * ((a.depth + b.depth) / 2) * density;
      ctx.strokeStyle = `rgb(${streakRgb} / ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const m of motes) {
    const alpha = Math.min(0.85, m.alpha * density);
    const tinted = m.tinted && tint !== null;
    const radius = m.size * 3 * swell;

    // A short tail in the direction of travel, longer the faster it moves.
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > 4) {
      ctx.globalAlpha = alpha * 0.5 * Math.min(1, speed / 40);
      ctx.strokeStyle = tinted ? (tint as string) : `rgb(${streakRgb})`;
      ctx.lineWidth = m.size * 0.6 * swell;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 0.2, m.y - m.vy * 0.2);
      ctx.stroke();
    }

    ctx.globalAlpha = tinted ? Math.min(0.85, alpha * 1.6) : alpha;
    ctx.drawImage(
      tinted && tintGlow ? tintGlow : glow,
      m.x - radius,
      m.y - radius,
      radius * 2,
      radius * 2,
    );
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
  return visible && document.visibilityState === 'visible';
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

function onPointerMove(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || !frame || !canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  pointerX = event.clientX - rect.left;
  pointerY = event.clientY - rect.top;
  pointerUntil = performance.now() + 150;
}

onMounted(() => {
  const el = canvas.value;
  if (!el) return;
  ctx = el.getContext('2d');
  readTheme();
  if (props.tint) tintGlow = sprite(props.tint);
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
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  sync();
});

watch(
  () => props.tint,
  (tint) => {
    tintGlow = tint ? sprite(tint) : null;
  },
);

// While paused there is no loop to pick up a new haze level; redraw once.
watch(
  () => [props.haze, props.tint],
  () => {
    if (!frame) {
      haze = props.haze ?? 0;
      motes = Array.from({ length: targetCount() }, spawn);
      draw(0);
    }
  },
  { flush: 'post' },
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  themeObserver?.disconnect();
  document.removeEventListener('visibilitychange', sync);
  window.removeEventListener('pointermove', onPointerMove);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="pointer-events-none inset-0 h-full w-full"
    :class="backdrop ? 'fixed' : 'absolute'"
    aria-hidden="true"
  />
</template>
