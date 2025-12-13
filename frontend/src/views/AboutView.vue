<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg bg-white p-6 shadow">
      <h2 class="mb-4 text-2xl font-semibold">{{ t('about.title') }}</h2>
      <p class="mb-4 text-gray-700">{{ t('about.description') }}</p>

      <h3 class="mb-2 mt-6 text-xl font-semibold">{{ t('about.mission') }}</h3>
      <p class="text-gray-700">{{ t('about.missionText') }}</p>

      <h3 class="mb-2 mt-6 text-xl font-semibold">{{ t('about.openSource') }}</h3>
      <p class="text-gray-700">{{ t('about.openSourceText') }}</p>

      <div class="mt-6 flex space-x-4">
        <a
          href="https://github.com/TripoliLabs/air-quality-monitoring"
          target="_blank"
          class="inline-flex items-center rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
        >
          GitHub
        </a>
        <a
          href="https://github.com/TripoliLabs"
          target="_blank"
          class="inline-flex items-center rounded bg-green-600 px-4 py-2 text-white hover:bg-green-500"
        >
          TripoliLabs
        </a>
      </div>
    </section>
  </div>
</template>
