<script setup lang="ts">
/**
 * The mark: three lines of moving air with one particle carried on them.
 * The air always drifts the same way on screen (from the sea, inland), so the
 * mark is not mirrored in Arabic.
 */
defineProps<{ size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 32"
    :height="size ?? 32"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    class="shrink-0"
  >
    <rect width="32" height="32" rx="9" class="fill-brand" />
    <g class="stroke-on-brand" stroke-width="2.2" stroke-linecap="round">
      <path d="M7 11.5h11.5a3 3 0 1 0-3-3" />
      <path d="M7 16.5h17" />
      <path d="M7 21.5h8.5a2.6 2.6 0 1 1-2.6 2.6" />
    </g>
    <circle cx="23.5" cy="21.5" r="1.7" class="fill-on-brand" />
  </svg>
</template>
