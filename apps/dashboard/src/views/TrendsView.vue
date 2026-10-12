<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import HourBars from '../components/HourBars.vue';
import LevelShare from '../components/LevelShare.vue';
import PageHeader from '../components/PageHeader.vue';
import RankBars, { type RankItem } from '../components/RankBars.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import type { ChartPoint } from '../components/TrendChart.vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { aqiCategory, pm25ToAqi } from '../lib/aqi';
import { hourOfDayProfile, levelCounts, mapLimit, toSeries } from '../lib/stats';
import { useAirStore } from '../stores/air';

const TrendChart = defineAsyncComponent(() => import('../components/TrendChart.vue'));

type Range = '24h' | '7d' | '30d';
const RANGE_DAYS: Record<Range, number> = { '24h': 1, '7d': 7, '30d': 30 };
const HOUR = 3_600_000;

const { t, n, metricValue, metricUnit, placeName } = useLocale();
const aqi = useAqi();
const store = useAirStore();
const { neighborhoods, citySeries, now } = storeToRefs(store);

const range = ref<Range>('7d');
const rangeOptions = computed(() =>
  (['24h', '7d', '30d'] as const).map((value) => ({ value, label: t(`sensor.range${value}`) })),
);

// One request for the city, then one per neighbourhood for the comparison.
watch(
  [range, () => neighborhoods.value.length],
  ([value]) => {
    const days = RANGE_DAYS[value];
    void store.loadCitySeries(days);
    void mapLimit(neighborhoods.value, 4, (place) => store.loadPlaceSeries(place, days));
  },
  { immediate: true },
);

const since = computed(() => now.value - RANGE_DAYS[range.value] * 24 * HOUR);
const series = computed(() => toSeries(citySeries.value.points, since.value));
const loading = computed(() => citySeries.value.days < RANGE_DAYS[range.value]);

const cityPoints = computed((): ChartPoint[] =>
  series.value.map((point) => ({ time: point.time, value: point.aqi })),
);

const day = computed(() => hourOfDayProfile(series.value));
const dayExtremes = computed(() => {
  const known = day.value.filter((h) => h.pm25 !== null);
  if (known.length < 12) return null;
  const clock = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;
  const worst = known.reduce((a, b) => ((b.pm25 ?? 0) > (a.pm25 ?? 0) ? b : a));
  const best = known.reduce((a, b) => ((b.pm25 ?? 0) < (a.pm25 ?? 0) ? b : a));
  return { worst: clock(worst.hour), best: clock(best.hour) };
});

const share = computed(() => levelCounts(series.value, (value) => aqiCategory(value).level));

const compared = computed((): RankItem[] =>
  neighborhoods.value
    .map((place) => {
      const points = toSeries(store.placeSeries[place.id]?.points ?? [], since.value);
      const pm25 = points.length
        ? points.reduce((sum, p) => sum + p.pm25, 0) / points.length
        : null;
      return { place, pm25 };
    })
    .sort((a, b) => (b.pm25 ?? -1) - (a.pm25 ?? -1))
    .map(({ place, pm25 }) => ({
      id: place.id,
      label: placeName(place),
      value: pm25,
      display: metricValue('pm25', pm25),
      color: aqi.solid(pm25 === null ? null : pm25ToAqi(pm25)),
      to: { name: 'neighborhood', params: { id: place.id } },
    })),
);
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <PageHeader :title="t('trends.title')" :intro="t('trends.intro')">
      <SegmentedControl v-model="range" :options="rangeOptions" :label="t('sensor.rangeLabel')" />
    </PageHeader>

    <p v-if="loading" class="text-sm text-ink-2" role="status">{{ t('trends.loading') }}</p>

    <section aria-labelledby="city-title" class="panel p-5 sm:p-6">
      <h2 id="city-title" class="text-xl">{{ t('trends.cityTitle') }}</h2>
      <p class="mt-1 mb-4 text-sm text-ink-2">{{ t('trends.cityHint') }}</p>
      <div v-if="loading" class="skeleton h-64 sm:h-80" />
      <p
        v-else-if="cityPoints.length < 2"
        class="flex h-64 items-center justify-center text-center text-sm text-ink-2"
      >
        {{ t('trends.empty') }}
      </p>
      <TrendChart
        v-else
        :points="cityPoints"
        metric="aqi"
        :hours="RANGE_DAYS[range] * 24"
        :label="`${t('trends.cityTitle')}, ${t(`sensor.range${range}`)}`"
      />
    </section>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-7">
      <section aria-labelledby="day-title" class="panel p-5 sm:p-6">
        <h2 id="day-title" class="text-xl">{{ t('trends.dayTitle') }}</h2>
        <p class="mt-1 mb-5 text-sm text-ink-2">{{ t('trends.dayHint') }}</p>
        <div v-if="loading" class="skeleton h-40" />
        <template v-else>
          <HourBars :hours="day" />
          <p v-if="dayExtremes" class="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
            <span>{{ t('trends.dayWorst', { hour: dayExtremes.worst }) }}</span>
            <span>{{ t('trends.dayBest', { hour: dayExtremes.best }) }}</span>
          </p>
        </template>
      </section>

      <section aria-labelledby="share-title" class="panel p-5 sm:p-6">
        <h2 id="share-title" class="text-xl">{{ t('trends.shareTitle') }}</h2>
        <p class="mt-1 mb-5 text-sm text-ink-2">
          {{ t('trends.shareHint') }}
          <span v-if="!loading && series.length" class="num"
            >({{ t('trends.hours', { count: n(series.length) }, series.length) }})</span
          >
        </p>
        <div v-if="loading" class="skeleton h-40" />
        <LevelShare v-else :counts="share" />
      </section>
    </div>

    <section aria-labelledby="compare-title" class="panel p-5 sm:p-6">
      <h2 id="compare-title" class="text-xl">{{ t('trends.compareTitle') }}</h2>
      <p class="mt-1 mb-2 text-sm text-ink-2">{{ t('trends.compareHint') }}</p>
      <div v-if="loading" class="space-y-4 pt-3">
        <div v-for="i in 5" :key="i" class="skeleton h-10" />
      </div>
      <RankBars
        v-else
        :items="compared"
        :unit="metricUnit('pm25')"
        class="lg:columns-2 lg:gap-10 [&>li]:break-inside-avoid"
      />
    </section>
  </div>
</template>
