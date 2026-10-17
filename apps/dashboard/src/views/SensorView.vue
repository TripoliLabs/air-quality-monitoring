<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AirVerdict from '../components/AirVerdict.vue';
import AppIcon from '../components/AppIcon.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import MetricTile from '../components/MetricTile.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import SkyPanel from '../components/SkyPanel.vue';
import StateBlock from '../components/StateBlock.vue';
import StatusLabel from '../components/StatusLabel.vue';
import type { ChartPoint } from '../components/TrendChart.vue';
import { useLocale } from '../composables/useLocale';
import { batteryPercent, formatDate } from '../lib/format';
import { METRIC_ORDER, METRICS, type MetricId } from '../lib/metrics';
import { useAirStore } from '../stores/air';

const SensorMap = defineAsyncComponent(() => import('../components/SensorMap.vue'));
const TrendChart = defineAsyncComponent(() => import('../components/TrendChart.vue'));

type Range = '24h' | '7d' | '30d';
const RANGE_HOURS: Record<Range, number> = { '24h': 24, '7d': 168, '30d': 720 };

const route = useRoute();
const { t, n, locale, metricValue, metricUnit, ago, sensorName, sensorPlace } = useLocale();
const store = useAirStore();
const { ready, now } = storeToRefs(store);

// Computed, not captured once: the component is reused when moving between sensors.
const sensorId = computed(() => String(route.params.id).toLowerCase());
const row = computed(() => store.getRow(sensorId.value));
const reading = computed(() => row.value?.reading ?? null);
const online = computed(() => row.value?.status === 'online');

const range = ref<Range>('24h');
const metric = ref<MetricId>('aqi');
const historyLoading = ref(false);

const rangeOptions = computed(() =>
  (['24h', '7d', '30d'] as const).map((value) => ({ value, label: t(`sensor.range${value}`) })),
);
const metricOptions = computed(() =>
  METRIC_ORDER.map((value) => ({ value, label: t(`metrics.${value}.short`) })),
);

let historyRequest = 0;
async function loadHistory(): Promise<void> {
  // Only the most recent request may end the loading state: the reader can
  // change range or sensor again before an earlier request has answered.
  const request = ++historyRequest;
  historyLoading.value = true;
  try {
    // The last day is shown reading by reading and keeps growing live; longer
    // ranges use the hourly aggregates.
    if (range.value === '24h') await store.loadReadings(sensorId.value, 24);
    else await store.loadHourly(sensorId.value, RANGE_HOURS[range.value] / 24);
  } catch {
    // The chart shows its empty state; the live values above are unaffected.
  } finally {
    if (request === historyRequest) historyLoading.value = false;
  }
}
watch([sensorId, range], loadHistory, { immediate: true });

const points = computed((): ChartPoint[] => {
  const def = METRICS[metric.value];
  if (range.value === '24h') {
    return (store.rawHistory[sensorId.value]?.readings ?? []).flatMap((r) => {
      const value = def.value(r);
      return value === undefined ? [] : [{ time: r.time, value }];
    });
  }
  const history = store.getHourly(sensorId.value, RANGE_HOURS[range.value] / 24) ?? [];
  return history.map((p) => ({ time: p.time, value: def.hourly(p) }));
});

const battery = computed(() => {
  const mv = reading.value?.batteryMv;
  return mv === undefined ? null : { percent: batteryPercent(mv), volts: mv / 1000 };
});
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <StateBlock
      v-if="ready && !row"
      icon="pin"
      :title="t('sensor.notFoundTitle')"
      :body="t('sensor.notFoundBody')"
    >
      <RouterLink :to="{ name: 'live' }" class="btn btn-primary">{{
        t('states.goLive')
      }}</RouterLink>
    </StateBlock>

    <template v-else>
      <SkyPanel :aqi="online ? (reading?.aqi ?? null) : null">
        <div class="p-5 sm:p-8 lg:p-10">
          <RouterLink
            :to="{ name: 'live' }"
            class="-ms-1 mb-5 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
          >
            <AppIcon name="back" directional />
            {{ t('sensor.back') }}
          </RouterLink>

          <div
            class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12"
          >
            <div>
              <div class="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div class="min-w-0">
                  <h1 v-if="row" class="text-xl font-medium sm:text-2xl">
                    {{ sensorName(row.sensor) }}
                  </h1>
                  <div v-else class="skeleton h-7 w-48" />
                  <RouterLink
                    v-if="row?.sensor.neighborhood"
                    :to="{ name: 'neighborhood', params: { id: row.sensor.neighborhoodId } }"
                    class="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
                  >
                    <AppIcon name="pin" class="text-sm" />
                    {{ sensorPlace(row.sensor) }}
                  </RouterLink>
                </div>
                <LiveIndicator v-if="online" />
                <StatusLabel v-else-if="row" :status="row.status" />
              </div>

              <AirVerdict
                :aqi="online ? (reading?.aqi ?? null) : null"
                :loading="!ready"
                :waiting-title="row ? t(`status.${row.status}`) : ''"
                :waiting-body="
                  reading
                    ? t('sensor.staleNote', { ago: ago(reading.time, now) })
                    : t('network.issueNever')
                "
              />
            </div>

            <dl class="grid grid-cols-2 content-end gap-x-6 border-t lg:border-t-0">
              <MetricTile
                v-for="id in ['pm25', 'pm10', 'temperature', 'humidity'] as const"
                :key="id"
                :label="t(`metrics.${id}.name`)"
                :hint="id.startsWith('pm') ? t(`metrics.${id}.short`) : undefined"
                :value="metricValue(id, reading ? METRICS[id].value(reading) : null)"
                :unit="metricUnit(id)"
              />
            </dl>
          </div>
        </div>
      </SkyPanel>

      <section aria-labelledby="history-title" class="panel p-5 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="history-title" class="text-xl">{{ t('sensor.history') }}</h2>
          <div class="flex max-w-full flex-wrap gap-2">
            <SegmentedControl
              v-model="metric"
              :options="metricOptions"
              :label="t('sensor.metricLabel')"
            />
            <SegmentedControl
              v-model="range"
              :options="rangeOptions"
              :label="t('sensor.rangeLabel')"
            />
          </div>
        </div>
        <div v-if="historyLoading && points.length < 2" class="skeleton h-64 sm:h-80" />
        <p
          v-else-if="points.length < 2"
          class="flex h-64 items-center justify-center text-sm text-ink-2 sm:h-80"
        >
          {{ t('sensor.historyEmpty') }}
        </p>
        <TrendChart
          v-else
          :points="points"
          :metric="metric"
          :hours="RANGE_HOURS[range]"
          :label="`${t(`metrics.${metric}.name`)}, ${t(`sensor.range${range}`)}`"
        />
      </section>

      <div v-if="row" class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-7">
        <section aria-labelledby="location-title">
          <h2 id="location-title" class="mb-3 text-xl">{{ t('sensor.location') }}</h2>
          <SensorMap class="h-72 lg:h-80" :rows="[row]" :focus-id="row.sensor.id" compact />
        </section>

        <section aria-labelledby="device-title" class="panel p-5 sm:p-6">
          <h2 id="device-title" class="mb-2 text-xl">{{ t('sensor.device') }}</h2>
          <dl class="divide-y divide-line text-sm">
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="text-ink-2">{{ t('sensors.status') }}</dt>
              <dd><StatusLabel :status="row.status" /></dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="text-ink-2">{{ t('sensors.lastSeen') }}</dt>
              <dd>{{ reading ? ago(reading.time, now) : t('sensors.never') }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="inline-flex items-center gap-2 text-ink-2">
                <AppIcon name="battery" />{{ t('sensor.battery') }}
              </dt>
              <dd v-if="battery" class="flex items-baseline gap-2">
                <span class="num font-medium">{{ n(battery.percent) }}%</span>
                <span class="num text-ink-3">{{ n(battery.volts, 2) }} V</span>
              </dd>
              <dd v-else>–</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="inline-flex items-center gap-2 text-ink-2">
                <AppIcon name="signal" />{{ t('sensor.signal') }}
              </dt>
              <dd v-if="reading?.signalStrength !== undefined">
                <span class="num font-medium">{{ n(reading.signalStrength) }}</span>
                {{ t('units.dbm') }}
              </dd>
              <dd v-else>–</dd>
            </div>
            <div
              v-if="reading?.pressure !== undefined"
              class="flex items-center justify-between gap-4 py-3"
            >
              <dt class="text-ink-2">{{ t('sensor.pressure') }}</dt>
              <dd>
                <span class="num font-medium">{{ n(reading.pressure) }}</span> hPa
              </dd>
            </div>
            <div v-if="row.sensor.installDate" class="flex items-center justify-between gap-4 py-3">
              <dt class="text-ink-2">{{ t('sensor.installed') }}</dt>
              <dd>{{ formatDate(row.sensor.installDate, locale) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="text-ink-2">{{ t('sensor.coordinates') }}</dt>
              <dd class="num">{{ n(row.sensor.latitude, 4) }}, {{ n(row.sensor.longitude, 4) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
              <dt class="text-ink-2">{{ t('sensor.deviceId') }}</dt>
              <dd class="font-mono text-xs break-all" dir="ltr">{{ row.sensor.id }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </div>
</template>
