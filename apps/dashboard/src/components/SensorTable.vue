<script setup lang="ts">
import AqiBadge from '@components/AqiBadge.vue';
import { useSensorsStore, type NeighborhoodSummary } from '@stores/sensors';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const store = useSensorsStore();
const router = useRouter();
const { t, locale } = useI18n();

const searchFilter = ref('');

function onRowClick(event: { data: NeighborhoodSummary }): void {
  router.push({ name: 'neighborhood', params: { id: event.data.id } });
}

function getName(row: NeighborhoodSummary): string {
  return locale.value === 'ar' ? row.nameAr : row.name;
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-100">{{ t('dashboard.allSensors') }}</h3>
      <InputText
        v-model="searchFilter"
        :placeholder="t('sensors.search')"
        class="w-64"
        size="small"
      />
    </div>
    <DataTable
      :value="store.neighborhoodSummaries"
      :global-filter-fields="['name', 'nameAr']"
      :global-filter="searchFilter"
      striped-rows
      row-hover
      sort-field="avgAqi"
      :sort-order="-1"
      class="cursor-pointer"
      @row-click="onRowClick"
    >
      <Column :header="t('sensors.neighborhood')" sortable sort-field="name">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="font-medium text-gray-100">{{ getName(data) }}</span>
        </template>
      </Column>
      <Column :header="t('sensors.count', { count: '' }).trim()" sortable sort-field="sensorCount">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="text-gray-400"> {{ data.onlineCount }}/{{ data.sensorCount }} </span>
        </template>
      </Column>
      <Column header="AQI" sortable sort-field="avgAqi">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <AqiBadge v-if="data.onlineCount > 0" :aqi="data.avgAqi" size="sm" />
          <span v-else class="text-gray-500">--</span>
        </template>
      </Column>
      <Column header="PM2.5" sortable sort-field="avgPm25">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="text-gray-300">{{ data.onlineCount > 0 ? data.avgPm25 : '--' }}</span>
        </template>
      </Column>
      <Column header="PM10" sortable sort-field="avgPm10">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="text-gray-300">{{ data.onlineCount > 0 ? data.avgPm10 : '--' }}</span>
        </template>
      </Column>
      <Column :header="t('readings.temperature')" sortable sort-field="avgTemp">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="text-gray-300">
            {{ data.onlineCount > 0 ? `${data.avgTemp}°C` : '--' }}
          </span>
        </template>
      </Column>
      <Column :header="t('readings.humidity')" sortable sort-field="avgHumidity">
        <template #body="{ data }: { data: NeighborhoodSummary }">
          <span class="text-gray-300">
            {{ data.onlineCount > 0 ? `${data.avgHumidity}%` : '--' }}
          </span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
