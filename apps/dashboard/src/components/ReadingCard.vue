<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  unit: string;
  icon: string;
}>();
</script>

<template>
  <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <div class="mb-2 flex items-center gap-2 text-gray-400">
      <i :class="icon" class="text-sm"></i>
      <span class="text-sm">{{ label }}</span>
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-3xl font-bold text-gray-100">{{ value }}</span>
      <span class="text-sm text-gray-500">{{ unit }}</span>
    </div>
  </div>
</template>
