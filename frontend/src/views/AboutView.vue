<script setup lang="ts">
import Card from 'primevue/card';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const hardwareItems = [
  { icon: 'pi pi-microchip', key: 'landing.technology.hardwareItems.mcu' },
  { icon: 'pi pi-cloud', key: 'landing.technology.hardwareItems.pm' },
  { icon: 'pi pi-sun', key: 'landing.technology.hardwareItems.env' },
  { icon: 'pi pi-bolt', key: 'landing.technology.hardwareItems.power' },
];

const softwareItems = [
  { icon: 'pi pi-wifi', key: 'landing.technology.softwareItems.network' },
  { icon: 'pi pi-database', key: 'landing.technology.softwareItems.database' },
  { icon: 'pi pi-server', key: 'landing.technology.softwareItems.api' },
  { icon: 'pi pi-desktop', key: 'landing.technology.softwareItems.frontend' },
];
</script>

<template>
  <div class="space-y-6">
    <!-- About -->
    <Card class="border border-gray-800 bg-gray-900">
      <template #title>
        <span class="text-gray-100">{{ t('about.title') }}</span>
      </template>
      <template #subtitle>
        <span class="text-emerald-400">{{ t('about.subtitle') }}</span>
      </template>
      <template #content>
        <p class="mb-4 text-gray-300">{{ t('about.description') }}</p>
      </template>
    </Card>

    <!-- Mission -->
    <Card class="border border-gray-800 bg-gray-900">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-heart text-emerald-400"></i>
          <span class="text-gray-100">{{ t('about.mission') }}</span>
        </div>
      </template>
      <template #content>
        <p class="text-gray-300">{{ t('about.missionText') }}</p>
      </template>
    </Card>

    <!-- Open Source -->
    <Card class="border border-gray-800 bg-gray-900">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-code text-emerald-400"></i>
          <span class="text-gray-100">{{ t('about.openSource') }}</span>
        </div>
      </template>
      <template #content>
        <p class="text-gray-300">{{ t('about.openSourceText') }}</p>
      </template>
    </Card>

    <!-- Technology Stack -->
    <Card class="border border-gray-800 bg-gray-900">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-cog text-emerald-400"></i>
          <span class="text-gray-100">{{ t('landing.technology.title') }}</span>
        </div>
      </template>
      <template #content>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <!-- Hardware -->
          <div>
            <h4 class="mb-3 font-semibold text-gray-200">
              <i class="pi pi-microchip mr-2 text-emerald-400"></i>
              {{ t('landing.technology.hardware') }}
            </h4>
            <ul class="space-y-2">
              <li
                v-for="item in hardwareItems"
                :key="item.key"
                class="flex items-center gap-2 text-sm text-gray-400"
              >
                <i :class="item.icon" class="text-xs text-gray-500"></i>
                {{ t(item.key) }}
              </li>
            </ul>
          </div>
          <!-- Software -->
          <div>
            <h4 class="mb-3 font-semibold text-gray-200">
              <i class="pi pi-code mr-2 text-emerald-400"></i>
              {{ t('landing.technology.software') }}
            </h4>
            <ul class="space-y-2">
              <li
                v-for="item in softwareItems"
                :key="item.key"
                class="flex items-center gap-2 text-sm text-gray-400"
              >
                <i :class="item.icon" class="text-xs text-gray-500"></i>
                {{ t(item.key) }}
              </li>
            </ul>
          </div>
        </div>
      </template>
    </Card>

    <!-- Links -->
    <div class="flex flex-wrap gap-3">
      <a
        href="https://github.com/TripoliLabs/air-quality-monitoring"
        target="_blank"
        class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-200 transition hover:bg-gray-700"
      >
        <i class="pi pi-github"></i>
        GitHub
      </a>
      <a
        href="https://github.com/TripoliLabs"
        target="_blank"
        class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition hover:bg-emerald-500"
      >
        <i class="pi pi-globe"></i>
        TripoliLabs
      </a>
    </div>
  </div>
</template>
