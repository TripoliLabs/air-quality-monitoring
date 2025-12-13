<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <section class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-semibold mb-4">{{ t('about.title') }}</h2>
      <p class="text-gray-700 mb-4">{{ t('about.description') }}</p>

      <h3 class="text-xl font-semibold mt-6 mb-2">{{ t('about.mission') }}</h3>
      <p class="text-gray-700">{{ t('about.missionText') }}</p>

      <h3 class="text-xl font-semibold mt-6 mb-2">{{ t('about.openSource') }}</h3>
      <p class="text-gray-700">{{ t('about.openSourceText') }}</p>

      <div class="mt-6 flex space-x-4">
        <a
          href="https://github.com/TripoliLabs/air-quality-monitoring"
          target="_blank"
          class="inline-flex items-center px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        >
          GitHub
        </a>
        <a
          href="https://github.com/TripoliLabs"
          target="_blank"
          class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500"
        >
          TripoliLabs
        </a>
      </div>
    </section>
  </div>
</template>
