<script setup lang="ts">
import AqiBadge from '@components/AqiBadge.vue';
import BatteryChart from '@components/BatteryChart.vue';
import SignalChart from '@components/SignalChart.vue';
import StatusPieChart from '@components/StatusPieChart.vue';
import { useSensorsStore, type SensorTimeSeries } from '@stores/sensors';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t, locale } = useI18n();
const store = useSensorsStore();
const router = useRouter();

onMounted(() => {
  if (!store.isSimulating) {
    store.startSimulation();
  }
});

function batteryPercent(mv: number): number {
  return Math.round(Math.min(100, Math.max(0, ((mv - 3200) / 1000) * 100)));
}

// Fleet stats
const totalSensors = computed(() => store.allSensors.length);
const onlineCount = computed(
  () => store.allSensors.filter((s) => s.definition.status === 'online').length,
);
const offlineCount = computed(
  () => store.allSensors.filter((s) => s.definition.status === 'offline').length,
);
const maintenanceCount = computed(
  () =>
    store.allSensors.filter((s) => s.definition.status === 'maintenance')
      .length,
);

const avgBattery = computed(() => {
  const withReadings = store.allSensors.filter((s) => s.latest);
  if (withReadings.length === 0) return 0;
  const sum = withReadings.reduce(
    (acc, s) => acc + batteryPercent(s.latest!.batteryMv),
    0,
  );
  return Math.round(sum / withReadings.length);
});

const avgSignal = computed(() => {
  const withReadings = store.allSensors.filter((s) => s.latest);
  if (withReadings.length === 0) return 0;
  const sum = withReadings.reduce(
    (acc, s) => acc + s.latest!.signalStrength,
    0,
  );
  return Math.round(sum / withReadings.length);
});

// Alerts
const lowBatteryCount = computed(() =>
  store.allSensors.filter(
    (s) => s.latest && batteryPercent(s.latest.batteryMv) < 30,
  ).length,
);
const weakSignalCount = computed(() =>
  store.allSensors.filter((s) => s.latest && s.latest.signalStrength < -70)
    .length,
);

const alerts = computed(() => {
  const items: { icon: string; text: string; color: string }[] = [];
  if (lowBatteryCount.value > 0) {
    items.push({
      icon: 'pi pi-exclamation-triangle',
      text: t('health.alertLowBattery', { count: lowBatteryCount.value }),
      color: 'text-red-400',
    });
  }
  if (weakSignalCount.value > 0) {
    items.push({
      icon: 'pi pi-exclamation-triangle',
      text: t('health.alertWeakSignal', { count: weakSignalCount.value }),
      color: 'text-yellow-400',
    });
  }
  if (offlineCount.value > 0) {
    items.push({
      icon: 'pi pi-times-circle',
      text: t('health.alertOffline', { count: offlineCount.value }),
      color: 'text-red-400',
    });
  }
  if (maintenanceCount.value > 0) {
    items.push({
      icon: 'pi pi-wrench',
      text: t('health.alertMaintenance', { count: maintenanceCount.value }),
      color: 'text-yellow-400',
    });
  }
  return items;
});

// Table data
const tableData = computed(() => store.allSensors);

function getSensorName(sensor: SensorTimeSeries): string {
  return locale.value === 'ar'
    ? sensor.definition.nameAr
    : sensor.definition.name;
}

function getNeighborhoodName(sensor: SensorTimeSeries): string {
  return locale.value === 'ar'
    ? sensor.definition.location.neighborhoodAr
    : sensor.definition.location.neighborhood;
}

function formatLastReading(sensor: SensorTimeSeries): string {
  if (!sensor.latest) return '--';
  const ts =
    sensor.latest.timestamp instanceof Date
      ? sensor.latest.timestamp
      : new Date(sensor.latest.timestamp);
  return ts.toLocaleTimeString(locale.value === 'ar' ? 'ar-LB' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function onRowClick(event: { data: SensorTimeSeries }): void {
  router.push({
    name: 'sensor-detail',
    params: { id: event.data.definition.id },
  });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-100">
        <i class="pi pi-heart mr-2 text-emerald-400"></i>
        {{ t('health.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-400">{{ t('health.subtitle') }}</p>
    </div>

    <!-- Fleet Overview Stats -->
    <div
      class="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.totalSensors') }}</p>
        <p class="text-xl font-bold text-gray-200">{{ totalSensors }}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.online') }}</p>
        <p class="text-xl font-bold text-green-400">{{ onlineCount }}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.offline') }}</p>
        <p class="text-xl font-bold text-red-400">{{ offlineCount }}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.maintenance') }}</p>
        <p class="text-xl font-bold text-yellow-400">{{ maintenanceCount }}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.avgBattery') }}</p>
        <p class="text-xl font-bold text-emerald-400">{{ avgBattery }}%</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500">{{ t('health.avgSignal') }}</p>
        <p class="text-xl font-bold text-sky-400">{{ avgSignal }} dBm</p>
      </div>
    </div>

    <!-- Charts Row 1: Battery + Signal -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('health.batteryLevels') }}
        </h3>
        <BatteryChart />
      </div>
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('health.signalStrength') }}
        </h3>
        <SignalChart />
      </div>
    </div>

    <!-- Charts Row 2: Status Pie + Alerts -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-300">
          {{ t('health.statusOverview') }}
        </h3>
        <StatusPieChart />
      </div>
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-3 text-sm font-semibold text-gray-300">
          {{ t('health.healthAlerts') }}
        </h3>
        <div v-if="alerts.length > 0" class="space-y-3">
          <div
            v-for="(alert, idx) in alerts"
            :key="idx"
            class="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3"
          >
            <i :class="[alert.icon, alert.color]"></i>
            <span class="text-sm text-gray-300">{{ alert.text }}</span>
          </div>
        </div>
        <div
          v-else
          class="flex h-full items-center justify-center py-10 text-sm text-green-400"
        >
          <i class="pi pi-check-circle mr-2"></i>
          {{ t('health.noAlerts') }}
        </div>
      </div>
    </div>

    <!-- Health Table -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-100">
        {{ t('health.sensorHealth') }}
      </h3>
      <DataTable
        :value="tableData"
        striped-rows
        row-hover
        sort-field="definition.name"
        :sort-order="1"
        class="cursor-pointer"
        @row-click="onRowClick"
      >
        <Column :header="t('health.name')" sortable sort-field="definition.name">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="font-medium text-gray-100">
              {{ getSensorName(data) }}
            </span>
          </template>
        </Column>
        <Column :header="t('health.neighborhood')">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-400">
              {{ getNeighborhoodName(data) }}
            </span>
          </template>
        </Column>
        <Column :header="t('health.status')">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
              :class="{
                'bg-green-900/40 text-green-400':
                  data.definition.status === 'online',
                'bg-red-900/40 text-red-400':
                  data.definition.status === 'offline',
                'bg-yellow-900/40 text-yellow-400':
                  data.definition.status === 'maintenance',
              }"
            >
              {{ data.definition.status }}
            </span>
          </template>
        </Column>
        <Column :header="t('health.battery')" sortable sort-field="latest.batteryMv">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span
              v-if="data.latest"
              class="text-gray-300"
              :class="{
                'text-red-400':
                  batteryPercent(data.latest.batteryMv) < 30,
                'text-yellow-400':
                  batteryPercent(data.latest.batteryMv) >= 30 &&
                  batteryPercent(data.latest.batteryMv) <= 60,
              }"
            >
              {{ batteryPercent(data.latest.batteryMv) }}%
            </span>
            <span v-else class="text-gray-500">--</span>
          </template>
        </Column>
        <Column :header="t('health.signal')" sortable sort-field="latest.signalStrength">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span
              v-if="data.latest"
              class="text-gray-300"
              :class="{
                'text-red-400': data.latest.signalStrength < -70,
                'text-yellow-400':
                  data.latest.signalStrength >= -70 &&
                  data.latest.signalStrength <= -50,
              }"
            >
              {{ data.latest.signalStrength }} dBm
            </span>
            <span v-else class="text-gray-500">--</span>
          </template>
        </Column>
        <Column header="AQI" sortable sort-field="latest.aqi">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <AqiBadge v-if="data.latest" :aqi="data.latest.aqi" size="sm" />
            <span v-else class="text-gray-500">--</span>
          </template>
        </Column>
        <Column :header="t('health.lastReading')">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-400">{{ formatLastReading(data) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
