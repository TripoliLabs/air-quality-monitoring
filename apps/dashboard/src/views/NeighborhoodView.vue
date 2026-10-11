<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, watch } from 'vue';
import { useRoute } from 'vue-router';
import AirSparkline from '../components/AirSparkline.vue';
import AirVerdict from '../components/AirVerdict.vue';
import AppIcon from '../components/AppIcon.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import MetricTile from '../components/MetricTile.vue';
import SensorTable from '../components/SensorTable.vue';
import SkyPanel from '../components/SkyPanel.vue';
import StateBlock from '../components/StateBlock.vue';
import { useLocale } from '../composables/useLocale';
import { formatClock } from '../lib/format';
import { toSeries } from '../lib/stats';
import { useAirStore } from '../stores/air';

const SensorMap = defineAsyncComponent(() => import('../components/SensorMap.vue'));
const HOUR = 3_600_000;

const route = useRoute();
const { t, n, locale, metricValue, metricUnit, placeName } = useLocale();
const store = useAirStore();
const { ready, now, lastLive } = storeToRefs(store);

const place = computed(() => store.getNeighborhood(String(route.params.id)));

// The neighbourhood is known only once the sensors have loaded.
watch(
  () => place.value?.id,
  () => {
    if (place.value) void store.loadPlaceSeries(place.value, 1);
  },
  { immediate: true },
);

const trend = computed(() => {
  if (!place.value) return [];
  const series = toSeries(store.placeSeries[place.value.id]?.points ?? [], now.value - 24 * HOUR);
  const { aqi, pm25, online } = place.value;
  if (series.length && aqi !== null && pm25 !== null) {
    series.push({ time: now.value, pm25, aqi, sensors: online });
  }
  return series;
});
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <StateBlock
      v-if="ready && !place"
      icon="pin"
      :title="t('neighborhood.notFoundTitle')"
      :body="t('neighborhood.notFoundBody')"
    >
      <RouterLink :to="{ name: 'live' }" class="btn btn-primary">{{
        t('states.goLive')
      }}</RouterLink>
    </StateBlock>

    <template v-else>
      <SkyPanel :aqi="place?.aqi ?? null">
        <div class="p-5 sm:p-8 lg:p-10">
          <RouterLink
            :to="{ name: 'live' }"
            class="-ms-1 mb-5 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
          >
            <AppIcon name="back" directional />
            {{ t('neighborhood.back') }}
          </RouterLink>

          <div
            class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12"
          >
            <div>
              <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h1 v-if="place" class="text-xl font-medium sm:text-2xl">{{ placeName(place) }}</h1>
                <div v-else class="skeleton h-7 w-48" />
                <LiveIndicator />
              </div>
              <AirVerdict
                :aqi="place?.aqi ?? null"
                :loading="!ready"
                :waiting-title="t('live.waitingTitle')"
                :waiting-body="t('live.waitingBody')"
              />
              <p v-if="place" class="mt-4 text-sm text-ink-2">
                {{ t('sensors.reporting', { online: n(place.online), total: n(place.total) }) }}
              </p>
            </div>

            <div class="flex flex-col justify-end gap-5">
              <div v-if="trend.length > 1">
                <h2 class="mb-2 text-sm font-normal text-ink-2">{{ t('neighborhood.trend') }}</h2>
                <AirSparkline :points="trend" :height="84" />
                <div class="num mt-1 flex justify-between text-xs text-ink-3" dir="ltr">
                  <span>{{ formatClock(trend[0].time, locale) }}</span>
                  <span>{{ formatClock(trend[trend.length - 1].time, locale) }}</span>
                </div>
              </div>
              <dl class="grid grid-cols-2 gap-x-6 border-t sm:grid-cols-4">
                <MetricTile
                  v-for="id in ['pm25', 'pm10', 'temperature', 'humidity'] as const"
                  :key="id"
                  :label="id.startsWith('pm') ? t(`metrics.${id}.short`) : t(`metrics.${id}.name`)"
                  :value="metricValue(id, place?.[id] ?? null)"
                  :unit="metricUnit(id)"
                />
              </dl>
            </div>
          </div>
        </div>
      </SkyPanel>

      <template v-if="place">
        <SensorMap class="h-[min(60vh,30rem)] min-h-80" :rows="place.rows" :pulse="lastLive" />

        <section aria-labelledby="sensors-title" class="panel p-5 sm:p-6">
          <h2 id="sensors-title" class="mb-4 text-xl">{{ t('neighborhood.sensors') }}</h2>
          <SensorTable :rows="place.rows" hide-place :searchable="false" />
        </section>
      </template>
    </template>
  </div>
</template>
