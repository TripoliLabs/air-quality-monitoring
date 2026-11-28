<script setup lang="ts">
/**
 * The sensor box coming apart and going back together: a 5-second loop rendered
 * from the node's 3D model (hardware/render). Two encodes, one per theme, so the
 * frame matches the panel it sits in.
 *
 * Kept cheap: nothing is downloaded until the figure is near the viewport, it
 * only plays while on screen, and with "reduce motion" it stays on the still
 * frame until the reader presses play.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import darkPoster from '../assets/node/node-dark-poster.webp';
import darkVideo from '../assets/node/node-dark.mp4';
import lightPoster from '../assets/node/node-light-poster.webp';
import lightVideo from '../assets/node/node-light.mp4';
import { useLocale } from '../composables/useLocale';
import { useTheme } from '../composables/usePrefs';
import AppIcon from './AppIcon.vue';

const { t } = useLocale();
const { isDark } = useTheme();

const figure = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
/** Set once the figure comes near the viewport; until then no video is fetched. */
const near = ref(false);
const onScreen = ref(false);
const playing = ref(false);
/** The reader's own choice wins over autoplay. */
const userPaused = ref(false);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const src = computed(() => (isDark.value ? darkVideo : lightVideo));
const poster = computed(() => (isDark.value ? darkPoster : lightPoster));

let observer: IntersectionObserver | null = null;

function sync(): void {
  const el = video.value;
  if (!el || !near.value) return;
  const want = onScreen.value && !userPaused.value && !document.hidden;
  if (want && el.paused) {
    el.play().catch(() => {
      playing.value = false;
    });
  } else if (!want && !el.paused) {
    el.pause();
  }
}

function toggle(): void {
  userPaused.value = playing.value;
  sync();
}

onMounted(() => {
  userPaused.value = reducedMotion.matches;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting || entry.intersectionRatio > 0) near.value = true;
      onScreen.value = entry.intersectionRatio >= 0.35;
      sync();
    },
    { rootMargin: '200px 0px', threshold: [0, 0.35] },
  );
  if (figure.value) observer.observe(figure.value);
  document.addEventListener('visibilitychange', sync);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', sync);
});

// A theme switch swaps the source; carry on from the same moment.
watch(src, () => {
  const el = video.value;
  if (!el) return;
  const at = el.currentTime;
  el.addEventListener(
    'loadedmetadata',
    () => {
      el.currentTime = at;
      sync();
    },
    { once: true },
  );
});
</script>

<template>
  <figure ref="figure" class="panel overflow-hidden">
    <div class="relative aspect-square w-full">
      <video
        ref="video"
        class="absolute inset-0 size-full object-contain"
        :src="near ? src : undefined"
        :poster="poster"
        muted
        loop
        playsinline
        preload="none"
        disablepictureinpicture
        :aria-label="t('about.node.label')"
        @play="playing = true"
        @pause="playing = false"
      />
      <button
        type="button"
        class="btn btn-quiet absolute end-3 bottom-3 bg-surface/90"
        :aria-pressed="!playing"
        @click="toggle"
      >
        <AppIcon :name="playing ? 'pause' : 'play'" />
        {{ playing ? t('about.node.pause') : t('about.node.play') }}
      </button>
    </div>
    <figcaption class="border-t px-5 py-3 text-sm text-ink-2">
      {{ t('about.node.caption') }}
    </figcaption>
  </figure>
</template>
