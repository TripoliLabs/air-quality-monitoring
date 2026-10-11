<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { I18nT } from 'vue-i18n';
import AppIcon from '../components/AppIcon.vue';
import PageHeader from '../components/PageHeader.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import { useLocale } from '../composables/useLocale';
import { config } from '../lib/config';
import { downloadFile, type ExportRow, hourlyRows, readingRows, toCsv } from '../lib/export';
import { mapLimit } from '../lib/stats';
import { useAirStore } from '../stores/air';

type Period = '24h' | '7d' | '30d';
type Format = 'csv' | 'json';

const { t, sensorName, sensorPlace } = useLocale();
const store = useAirStore();
const { sensors } = storeToRefs(store);

const sensorId = ref('all');
const period = ref<Period>('24h');
const format = ref<Format>('csv');
const busy = ref(false);
const message = ref<string | null>(null);

const formatOptions = [
  { value: 'csv' as const, label: 'CSV' },
  { value: 'json' as const, label: 'JSON' },
];
const sortedSensors = computed(() =>
  [...sensors.value].sort((a, b) =>
    sensorName(a).localeCompare(sensorName(b), undefined, { numeric: true }),
  ),
);

async function download(): Promise<void> {
  busy.value = true;
  message.value = null;
  try {
    const chosen =
      sensorId.value === 'all'
        ? sensors.value
        : sensors.value.filter((s) => s.id === sensorId.value);
    const perSensor = await mapLimit(chosen, 4, async (sensor): Promise<ExportRow[]> => {
      if (period.value === '24h')
        return readingRows(sensor, await store.fetchReadings(sensor.id, 24));
      return hourlyRows(sensor, await store.fetchHourly(sensor.id, period.value === '7d' ? 7 : 30));
    });
    const rows = perSensor.flat();
    if (rows.length === 0) {
      message.value = t('data.empty');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `qalawun-${sensorId.value === 'all' ? 'all-sensors' : sensorId.value}-${period.value}-${stamp}`;
    if (format.value === 'csv') downloadFile(toCsv(rows), `${name}.csv`, 'text/csv;charset=utf-8');
    else downloadFile(JSON.stringify(rows, null, 2), `${name}.json`, 'application/json');
  } catch {
    message.value = t('data.failed');
  } finally {
    busy.value = false;
  }
}

const apiBase = new URL(config.apiBase, window.location.origin).href.replace(/\/$/, '');
const endpoints = [
  { path: '/sensors', key: 'sensors' },
  { path: '/sensors/latest', key: 'latest' },
  { path: '/sensors/{deviceId}/latest', key: 'sensorLatest' },
  { path: '/sensors/{deviceId}/readings?hours=24', key: 'readings' },
  { path: '/sensors/{deviceId}/history?days=7', key: 'history' },
  { path: '/overview', key: 'overview' },
] as const;
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <PageHeader :title="t('data.title')" :intro="t('data.intro')" />

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start lg:gap-7">
      <section aria-labelledby="download-title" class="panel p-5 sm:p-6">
        <h2 id="download-title" class="mb-4 text-xl">{{ t('data.downloadTitle') }}</h2>
        <form class="space-y-4" @submit.prevent="download">
          <label class="block">
            <span class="mb-1.5 block text-sm text-ink-2">{{ t('data.sensor') }}</span>
            <select
              v-model="sensorId"
              class="h-11 w-full rounded-control border bg-surface px-3 text-sm"
            >
              <option value="all">{{ t('data.allSensors') }}</option>
              <option v-for="sensor in sortedSensors" :key="sensor.id" :value="sensor.id">
                {{ sensorName(sensor) }} ({{ sensorPlace(sensor) }})
              </option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm text-ink-2">{{ t('data.period') }}</span>
            <select
              v-model="period"
              class="h-11 w-full rounded-control border bg-surface px-3 text-sm"
            >
              <option value="24h">{{ t('data.period24h') }}</option>
              <option value="7d">{{ t('data.period7d') }}</option>
              <option value="30d">{{ t('data.period30d') }}</option>
            </select>
          </label>
          <div>
            <span class="mb-1.5 block text-sm text-ink-2">{{ t('data.format') }}</span>
            <SegmentedControl v-model="format" :options="formatOptions" :label="t('data.format')" />
          </div>
          <button type="submit" class="btn btn-primary w-full disabled:opacity-60" :disabled="busy">
            <AppIcon name="download" />
            {{ busy ? t('data.preparing') : t('data.download') }}
          </button>
          <p v-if="message" class="text-sm text-ink-2" role="status">{{ message }}</p>
        </form>

        <h3 class="mt-8 mb-1 font-medium">{{ t('data.licenseTitle') }}</h3>
        <p class="text-sm text-ink-2">{{ t('data.licenseBody') }}</p>
      </section>

      <section aria-labelledby="api-title" class="panel p-5 sm:p-6">
        <h2 id="api-title" class="mb-2 text-xl">{{ t('data.apiTitle') }}</h2>
        <p class="text-sm text-ink-2">{{ t('data.apiIntro') }}</p>
        <code
          class="mt-2 block overflow-x-auto rounded-control bg-sunken px-3 py-2 font-mono text-sm"
          dir="ltr"
          >{{ apiBase }}</code
        >

        <ul class="mt-4 divide-y divide-line">
          <li v-for="endpoint in endpoints" :key="endpoint.key" class="py-3">
            <code class="block overflow-x-auto font-mono text-sm whitespace-nowrap" dir="ltr">
              <span class="font-semibold text-brand">GET</span> {{ endpoint.path }}
            </code>
            <p class="mt-1 text-sm text-ink-2">{{ t(`data.endpoints.${endpoint.key}`) }}</p>
          </li>
        </ul>

        <a
          :href="`${apiBase}/docs`"
          target="_blank"
          rel="noopener"
          class="link mt-2 inline-flex items-center gap-1.5 text-sm"
        >
          {{ t('data.apiDocs') }}
          <AppIcon name="external" class="text-xs" />
        </a>

        <h3 class="mt-8 mb-1 font-medium">{{ t('data.liveTitle') }}</h3>
        <I18nT keypath="data.liveBody" tag="p" class="text-sm text-ink-2" scope="global">
          <template #event
            ><code class="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.8125rem]" dir="ltr"
              >reading</code
            ></template
          >
        </I18nT>
      </section>
    </div>
  </div>
</template>
