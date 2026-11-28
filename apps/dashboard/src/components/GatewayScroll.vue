<script setup lang="ts">
/** The Dragino DLOS8N gateway opening into its parts. Drawn from Dragino's enclosure
 * drawings; the inside is not published, so it is not drawn. */
import track from '../assets/gateway/labels.json';
import { useLocale } from '../composables/useLocale';
import ExplodeScroll from './ExplodeScroll.vue';

const { t } = useLocale();

const FRAMES = Object.entries(
  import.meta.glob<string>('../assets/gateway/g_*.webp', {
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
    :sides="{ antenna: 'l', body: 'l', cables: 'l', leds: 'r', mount: 'r' }"
    messages="about.gateway"
    :steps="['roof', 'inside', 'power']"
    :title="t('about.gateway.title')"
    title-id="gateway-title"
    :aspect="0.75"
  />
</template>
