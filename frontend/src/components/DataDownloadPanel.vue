<script setup lang="ts">
import {
  countReadings,
  downloadFile,
  generateCSV,
  generateJSON,
} from '@composables/useDataExport';
import { useSensorsStore } from '@stores/sensors';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const store = useSensorsStore();

const fromDate = ref('');
const toDate = ref('');
const format = ref<'csv' | 'json'>('csv');
const selectedSensorIds = ref<Set<string>>(new Set());
const allSelected = ref(true);

// Initialize: select all sensors
const sensors = computed(() => store.allSensors);

function toggleSelectAll(): void {
  if (allSelected.value) {
    selectedSensorIds.value = new Set(
      sensors.value.map((s) => s.definition.id),
    );
  } else {
    selectedSensorIds.value = new Set();
  }
}

function toggleSensor(id: string): void {
  const s = selectedSensorIds.value;
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  allSelected.value = s.size === sensors.value.length;
}

const filteredSensors = computed(() => {
  if (allSelected.value) return sensors.value;
  return sensors.value.filter((s) =>
    selectedSensorIds.value.has(s.definition.id),
  );
});

const parsedFrom = computed(() =>
  fromDate.value ? new Date(fromDate.value) : null,
);
const parsedTo = computed(() =>
  toDate.value
    ? new Date(new Date(toDate.value).getTime() + 86400000 - 1)
    : null,
);

const readingCount = computed(() =>
  countReadings(filteredSensors.value, parsedFrom.value, parsedTo.value),
);

function getSensorName(sensor: (typeof sensors.value)[0]): string {
  return locale.value === 'ar'
    ? sensor.definition.nameAr
    : sensor.definition.name;
}

function doDownload(): void {
  if (readingCount.value === 0) return;

  const timestamp = new Date().toISOString().slice(0, 10);
  if (format.value === 'csv') {
    const csv = generateCSV(
      filteredSensors.value,
      parsedFrom.value,
      parsedTo.value,
      locale.value,
    );
    downloadFile(csv, `qalawun-data-${timestamp}.csv`, 'text/csv');
  } else {
    const json = generateJSON(
      filteredSensors.value,
      parsedFrom.value,
      parsedTo.value,
      locale.value,
    );
    downloadFile(json, `qalawun-data-${timestamp}.json`, 'application/json');
  }
}
</script>

<template>
  <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <h3 class="mb-4 text-lg font-semibold text-gray-100">
      <i class="pi pi-download mr-2 text-emerald-400"></i>
      {{ t('download.title') }}
    </h3>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <!-- Date Range -->
      <div>
        <label class="mb-1 block text-xs text-gray-400">{{
          t('download.dateRange')
        }}</label>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-xs text-gray-500">{{ t('download.from') }}</label>
            <input
              v-model="fromDate"
              type="date"
              class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            />
          </div>
          <div class="flex-1">
            <label class="text-xs text-gray-500">{{ t('download.to') }}</label>
            <input
              v-model="toDate"
              type="date"
              class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            />
          </div>
        </div>
      </div>

      <!-- Sensor Selection -->
      <div>
        <label class="mb-1 block text-xs text-gray-400">{{
          t('download.sensors')
        }}</label>
        <div class="max-h-32 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-2">
          <label class="mb-1 flex cursor-pointer items-center gap-2 text-sm text-gray-200">
            <input
              v-model="allSelected"
              type="checkbox"
              class="accent-emerald-500"
              @change="toggleSelectAll"
            />
            {{ t('download.selectAll') }}
          </label>
          <div class="border-t border-gray-700 pt-1">
            <label
              v-for="sensor in sensors"
              :key="sensor.definition.id"
              class="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-gray-400"
            >
              <input
                type="checkbox"
                :checked="
                  allSelected || selectedSensorIds.has(sensor.definition.id)
                "
                class="accent-emerald-500"
                @change="toggleSensor(sensor.definition.id)"
              />
              {{ getSensorName(sensor) }}
            </label>
          </div>
        </div>
      </div>

      <!-- Format + Download -->
      <div class="flex flex-col justify-between">
        <div>
          <label class="mb-1 block text-xs text-gray-400">{{
            t('download.format')
          }}</label>
          <div class="flex gap-3">
            <label class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-200">
              <input
                v-model="format"
                type="radio"
                value="csv"
                class="accent-emerald-500"
              />
              CSV
            </label>
            <label class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-200">
              <input
                v-model="format"
                type="radio"
                value="json"
                class="accent-emerald-500"
              />
              JSON
            </label>
          </div>
        </div>

        <div class="mt-3">
          <p class="mb-2 text-xs text-gray-500">
            {{ t('download.readingsCount', { count: readingCount }) }}
          </p>
          <button
            class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            :disabled="readingCount === 0"
            @click="doDownload"
          >
            <i class="pi pi-download mr-1.5"></i>
            {{ t('download.download') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
