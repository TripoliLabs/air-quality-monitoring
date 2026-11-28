<script setup lang="ts">
/**
 * The dashboard's icon set, inline so there is no icon font to download.
 * 24-unit grid, 1.75 stroke, drawn to sit next to Readex Pro at text sizes.
 */
import { computed } from 'vue';

export type IconName =
  | 'live'
  | 'trends'
  | 'network'
  | 'about'
  | 'data'
  | 'sun'
  | 'moon'
  | 'search'
  | 'chevron'
  | 'back'
  | 'battery'
  | 'signal'
  | 'alert'
  | 'check'
  | 'pin'
  | 'external'
  | 'download'
  | 'sort'
  | 'close';

const props = defineProps<{
  name: IconName;
  /** Mirror in right-to-left layouts (arrows and chevrons that point "forward"). */
  directional?: boolean;
}>();

const PATHS: Record<IconName, string> = {
  live: 'M3 12h3.5l2.5-6 4 12 2.5-6H21',
  trends: 'M4 19V5M4 19h16M8 15l3.5-4 3 2.5L19 8',
  network:
    'M12 13v8M8.5 9.5a5 5 0 0 1 7 0M5.5 6.5a9.2 9.2 0 0 1 13 0M12 13a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.75v.25',
  data: 'M5 6.5c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5-7-1.1-7-2.5ZM5 6.5v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.5M5 12v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  chevron: 'm9 6 6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  battery:
    'M4 8.5h13a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1ZM21 11v2M6.5 11.5v1M9.5 11.5v1',
  signal: 'M5 19v-3M10 19v-7M15 19V8M20 19V4',
  alert: 'M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17v.25',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  pin: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  external: 'M14 5h5v5M19 5l-8 8M11 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5',
  download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14',
  sort: 'm8 9 4-4 4 4M8 15l4 4 4-4',
  close: 'M6 6l12 12M18 6 6 18',
};

const path = computed(() => PATHS[props.name]);
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="1.25em"
    height="1.25em"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
    :class="{ 'rtl:-scale-x-100': directional }"
  >
    <path :d="path" />
  </svg>
</template>
