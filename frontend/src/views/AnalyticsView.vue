<script setup lang="ts">
import AqiBadge from '@components/AqiBadge.vue';
import AqiDistributionChart from '@components/AqiDistributionChart.vue';
import HourlyProfileChart from '@components/HourlyProfileChart.vue';
import NeighborhoodBarChart from '@components/NeighborhoodBarChart.vue';
import Pm25TempScatter from '@components/Pm25TempScatter.vue';
import { useSensorsStore } from '@stores/sensors';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const store = useSensorsStore();

onMounted(() => {
  if (!store.isSimulating) {
    store.startSimulation();
  }
});

const rankedNeighborhoods = computed(() => {
  return [...store.neighborhoodSummaries]
    .filter((n) => n.onlineCount > 0)
    .sort((a, b) => b.avgAqi - a.avgAqi);
});

function getNeighborhoodName(row: (typeof rankedNeighborhoods.value)[0]): string {
  return locale.value === 'ar' ? row.nameAr : row.name;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-100">
        <i class="pi pi-chart-bar mr-2 text-emerald-400"></i>
        {{ t('analytics.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-400">{{ t('analytics.subtitle') }}</p>
    </div>

    <!-- 2x2 Chart Grid -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('analytics.neighborhoodComparison') }}
        </h3>
        <NeighborhoodBarChart />
      </div>

      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('analytics.hourlyProfile') }}
        </h3>
        <HourlyProfileChart />
      </div>

      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('analytics.pm25VsTemp') }}
        </h3>
        <Pm25TempScatter />
      </div>

      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('analytics.aqiDistribution') }}
        </h3>
        <AqiDistributionChart />
      </div>
    </div>

    <!-- Top Polluted Areas Table -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-100">
        {{ t('analytics.topPolluted') }}
      </h3>
      <DataTable
        :value="rankedNeighborhoods"
        striped-rows
        row-hover
      >
        <Column :header="t('analytics.rank')">
          <template #body="{ index }">
            <span class="font-bold text-gray-300">{{ index + 1 }}</span>
          </template>
        </Column>
        <Column :header="t('analytics.neighborhood')">
          <template #body="{ data }">
            <span class="font-medium text-gray-100">
              {{ getNeighborhoodName(data) }}
            </span>
          </template>
        </Column>
        <Column :header="t('analytics.avgAqi')" sortable sort-field="avgAqi">
          <template #body="{ data }">
            <AqiBadge :aqi="data.avgAqi" size="sm" />
          </template>
        </Column>
        <Column :header="t('analytics.avgPm25')" sortable sort-field="avgPm25">
          <template #body="{ data }">
            <span class="text-gray-300">{{ data.avgPm25 }} µg/m³</span>
          </template>
        </Column>
        <Column :header="t('analytics.sensorCount')" sortable sort-field="sensorCount">
          <template #body="{ data }">
            <span class="text-gray-300">{{ data.sensorCount }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
