<script setup lang="ts">
/** The sensor box opening into its parts (frames from hardware/render/node.py). */
import track from '../assets/node/labels.json';
import { useLocale } from '../composables/useLocale';
import ExplodeScroll from './ExplodeScroll.vue';

const { t } = useLocale();

const FRAMES = Object.entries(
  import.meta.glob<string>('../assets/node/f_*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);
</script>

<template>
  <ExplodeScroll
    :frames="FRAMES"
    :track="track"
    :sides="{ panel: 'l', boost: 'l', pms: 'l', antenna: 'r', tbeam: 'r', bme: 'r' }"
    messages="about.node"
    :steps="['whole', 'top', 'bottom']"
    :title="t('about.hardwareTitle')"
    title-id="hardware-title"
    :aspect="1"
  />
</template>
