<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const currentFeatures = [
  { icon: 'pi pi-bolt', key: 'featuresPage.features.realtime' },
  { icon: 'pi pi-map', key: 'featuresPage.features.maps' },
  { icon: 'pi pi-sitemap', key: 'featuresPage.features.network' },
  { icon: 'pi pi-language', key: 'featuresPage.features.bilingual' },
  { icon: 'pi pi-sun', key: 'featuresPage.features.solar' },
  { icon: 'pi pi-wifi', key: 'featuresPage.features.lorawan' },
];

const upcomingFeatures = [
  { icon: 'pi pi-mobile', key: 'featuresPage.upcoming.mobile' },
  { icon: 'pi pi-bell', key: 'featuresPage.upcoming.alerts' },
  { icon: 'pi pi-link', key: 'featuresPage.upcoming.openaq' },
  { icon: 'pi pi-chart-bar', key: 'featuresPage.upcoming.reports' },
  { icon: 'pi pi-code', key: 'featuresPage.upcoming.api' },
];

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
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-100">
        <i class="pi pi-star mr-2 text-emerald-400"></i>
        {{ t('featuresPage.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-400">{{ t('featuresPage.subtitle') }}</p>
    </div>

    <!-- Current Features -->
    <div>
      <h2 class="mb-3 text-lg font-semibold text-gray-200">
        {{ t('featuresPage.current') }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="feature in currentFeatures"
          :key="feature.key"
          class="rounded-xl border border-gray-800 bg-gray-900 p-5"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15"
          >
            <i :class="feature.icon" class="text-lg text-emerald-400"></i>
          </div>
          <h3 class="mb-1 font-semibold text-gray-100">
            {{ t(`${feature.key}.title`) }}
          </h3>
          <p class="text-sm text-gray-400">
            {{ t(`${feature.key}.description`) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Upcoming Features -->
    <div>
      <h2 class="mb-3 text-lg font-semibold text-gray-200">
        {{ t('featuresPage.upcomingTitle') }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="feature in upcomingFeatures"
          :key="feature.key"
          class="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-5"
        >
          <div class="mb-3 flex items-center justify-between">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10"
            >
              <i :class="feature.icon" class="text-lg text-sky-400"></i>
            </div>
            <span
              class="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-400"
            >
              {{ t('featuresPage.comingSoon') }}
            </span>
          </div>
          <h3 class="mb-1 font-semibold text-gray-100">
            {{ t(`${feature.key}.title`) }}
          </h3>
          <p class="text-sm text-gray-400">
            {{ t(`${feature.key}.description`) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Technology Stack -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 class="mb-4 text-lg font-semibold text-gray-200">
        <i class="pi pi-cog mr-2 text-emerald-400"></i>
        {{ t('featuresPage.techStack') }}
      </h2>
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
    </div>
  </div>
</template>
