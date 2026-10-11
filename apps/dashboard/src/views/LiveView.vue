<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, onMounted } from 'vue';
import AirSparkline from '../components/AirSparkline.vue';
import AirVerdict from '../components/AirVerdict.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import MetricTile from '../components/MetricTile.vue';
import RankBars, { type RankItem } from '../components/RankBars.vue';
import SensorTable from '../components/SensorTable.vue';
import SkyPanel from '../components/SkyPanel.vue';
import StateBlock from '../components/StateBlock.vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { formatClock } from '../lib/format';
import { useAirStore } from '../stores/air';

// The map library is the heaviest thing on the page; the verdict paints first.
const SensorMap = defineAsyncComponent(() => import('../components/SensorMap.vue'));

const { t, n, locale, metricValue, metricUnit, placeName } = useLocale();
const aqi = useAqi();
const store = useAirStore();
const { city, rows, neighborhoods, cityTrend, ready, lastLive } = storeToRefs(store);

onMounted(() => void store.ensureNetworkHourly(1));

const ranked = computed((): RankItem[] =>
  [...neighborhoods.value]
    .sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1))
    .map((place) => ({
      id: place.id,
      label: placeName(place),
      sub: t('sensors.reporting', { online: n(place.online), total: n(place.total) }),
      value: place.aqi,
      display: n(place.aqi),
      color: aqi.solid(place.aqi),
      to: { name: 'neighborhood', params: { id: place.id } },
    })),
);

const trendRange = computed(() => {
  const points = cityTrend.value;
  if (points.length < 2) return null;
  return {
    from: formatClock(points[0].time, locale.value),
    to: formatClock(points[points.length - 1].time, locale.value),
    low: Math.min(...points.map((p) => p.aqi)),
    high: Math.max(...points.map((p) => p.aqi)),
  };
});
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <h1 class="sr-only">{{ t('live.title') }}</h1>

    <SkyPanel :aqi="city.aqi">
      <div
        class="grid grid-cols-1 gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:p-10"
      >
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p class="font-medium text-ink-2">{{ t('live.context') }}</p>
            <LiveIndicator show-updated />
          </div>
          <AirVerdict
            :aqi="city.aqi"
            :loading="!ready"
            :waiting-title="t('live.waitingTitle')"
            :waiting-body="t('live.waitingBody')"
          />
          <p v-if="city.aqi !== null" class="mt-4 text-sm text-ink-2">
            {{ t('live.basis', { count: n(city.online) }, city.online) }}
          </p>
        </div>

        <div class="flex flex-col justify-end gap-5">
          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <h2 class="font-normal text-ink-2">{{ t('live.trend') }}</h2>
              <p v-if="trendRange" class="num shrink-0 text-ink-2">
                {{ n(trendRange.low) }}–{{ n(trendRange.high) }}
              </p>
            </div>
            <template v-if="trendRange">
              <AirSparkline :points="cityTrend" :height="84" />
              <div class="num mt-1 flex justify-between text-xs text-ink-3" dir="ltr">
                <span>{{ trendRange.from }}</span>
                <span>{{ trendRange.to }}</span>
              </div>
            </template>
            <div v-else-if="!ready || store.networkHourlyLoading" class="skeleton h-[84px]" />
            <p v-else class="text-sm text-ink-3">{{ t('live.trendEmpty') }}</p>
          </div>

          <dl class="grid grid-cols-2 gap-x-6 border-t sm:grid-cols-4">
            <MetricTile
              :label="t('metrics.pm25.short')"
              :value="metricValue('pm25', city.pm25)"
              :unit="metricUnit('pm25')"
            />
            <MetricTile
              :label="t('metrics.pm10.short')"
              :value="metricValue('pm10', city.pm10)"
              :unit="metricUnit('pm10')"
            />
            <MetricTile
              :label="t('metrics.temperature.name')"
              :value="metricValue('temperature', city.temperature)"
              :unit="metricUnit('temperature')"
            />
            <MetricTile
              :label="t('metrics.humidity.name')"
              :value="metricValue('humidity', city.humidity)"
              :unit="metricUnit('humidity')"
            />
          </dl>
        </div>
      </div>
    </SkyPanel>

    <StateBlock
      v-if="ready && rows.length === 0"
      icon="network"
      :title="t('live.noSensorsTitle')"
      :body="t('live.noSensorsBody')"
    />

    <template v-else>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-7">
        <section aria-labelledby="map-title" class="flex flex-col">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 id="map-title" class="text-xl">{{ t('live.mapTitle') }}</h2>
            <p class="text-sm text-ink-2">{{ t('live.mapHint') }}</p>
          </div>
          <SensorMap
            class="h-[min(68vh,34rem)] min-h-[22rem] lg:h-auto lg:min-h-[34rem] lg:flex-1"
            :rows="rows"
            :pulse="lastLive"
          />
        </section>

        <section aria-labelledby="places-title" class="panel p-5 sm:p-6">
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="places-title" class="text-xl">{{ t('live.neighborhoodsTitle') }}</h2>
            <p class="text-sm text-ink-2">{{ t('live.neighborhoodsHint') }}</p>
          </div>
          <div v-if="!ready" class="space-y-4 pt-3">
            <div v-for="i in 6" :key="i" class="skeleton h-10" />
          </div>
          <RankBars v-else :items="ranked" />
        </section>
      </div>

      <section aria-labelledby="sensors-title" class="panel p-5 sm:p-6">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="sensors-title" class="text-xl">{{ t('live.sensorsTitle') }}</h2>
          <p v-if="ready" class="text-sm text-ink-2">
            {{ t('sensors.reporting', { online: n(city.online), total: n(city.total) }) }}
          </p>
        </div>
        <div v-if="!ready" class="space-y-3">
          <div v-for="i in 5" :key="i" class="skeleton h-11" />
        </div>
        <SensorTable v-else :rows="rows" :limit="12" />
      </section>
    </template>
  </div>
</template>
