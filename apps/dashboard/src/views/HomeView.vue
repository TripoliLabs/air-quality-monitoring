<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import AqiMeter from '../components/AqiMeter.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import SkyPanel from '../components/SkyPanel.vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { useAirStore } from '../stores/air';

const { t, n } = useLocale();
const aqi = useAqi();
const { city, neighborhoods, ready } = storeToRefs(useAirStore());

const steps = ['measure', 'send', 'process', 'show'] as const;
const built = ['solar', 'radio', 'open'] as const;

// Only numbers the network itself reports — nothing here is typed in by hand.
const stats = computed(() => [
  { value: city.value.online, label: t('home.statsSensors', city.value.online) },
  {
    value: neighborhoods.value.length,
    label: t('home.statsNeighborhoods', neighborhoods.value.length),
  },
  { value: 5, label: t('home.statsCadence') },
]);
</script>

<template>
  <div>
    <SkyPanel :aqi="city.aqi" :density="1.25" flush class="border-b">
      <div
        class="shell grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16 lg:py-24"
      >
        <div>
          <h1
            class="text-[clamp(2.125rem,1.2rem+4.2vw,4.5rem)] leading-[1.06] font-semibold tracking-[-0.03em]"
          >
            {{ t('home.title') }}
          </h1>
          <p class="mt-6 max-w-xl text-lg text-ink-2 sm:text-xl">{{ t('home.lede') }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <RouterLink :to="{ name: 'live' }" class="btn btn-primary min-h-12 px-6 text-base">
              {{ t('home.openLive') }}
              <AppIcon name="chevron" directional />
            </RouterLink>
            <a href="#how" class="btn btn-quiet min-h-12 bg-surface/60 px-6 text-base">{{
              t('home.learn')
            }}</a>
          </div>
        </div>

        <!-- The live answer, right on the front page. -->
        <RouterLink
          :to="{ name: 'live' }"
          class="group block rounded-panel border bg-surface/80 p-5 backdrop-blur-sm transition-colors hover:bg-surface sm:p-6"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-ink-2">{{ t('home.nowLabel') }}</p>
            <LiveIndicator />
          </div>
          <template v-if="!ready">
            <div class="skeleton mt-4 h-10 w-44" />
            <div class="skeleton mt-4 h-5 w-56 max-w-full" />
          </template>
          <template v-else-if="city.aqi === null">
            <p class="mt-4 text-xl font-medium">{{ t('home.nowWaiting') }}</p>
          </template>
          <template v-else>
            <p :key="aqi.name(city.aqi)" class="settle mt-3 text-3xl font-semibold sm:text-4xl">
              {{ aqi.name(city.aqi) }}
            </p>
            <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <AqiMeter :aqi="city.aqi" />
              <p class="flex items-baseline gap-2">
                <span class="text-sm text-ink-2">{{ t('aqi.label') }}</span>
                <span
                  :key="city.aqi"
                  class="num settle text-2xl font-semibold"
                  :style="{ color: aqi.text(city.aqi) }"
                >
                  {{ n(city.aqi) }}
                </span>
              </p>
            </div>
            <p class="mt-4 text-[0.9375rem] text-ink-2">{{ aqi.advice(city.aqi) }}</p>
          </template>
          <p class="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand">
            {{ t('home.openLive') }}
            <AppIcon
              name="chevron"
              directional
              class="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            />
          </p>
        </RouterLink>
      </div>
    </SkyPanel>

    <div class="shell">
      <dl class="grid grid-cols-3 divide-x divide-line border-b rtl:divide-x-reverse">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="min-w-0 px-3 py-6 first:ps-0 sm:px-8 sm:py-8"
        >
          <dd class="num text-3xl font-semibold sm:text-5xl">
            <span v-if="ready" :key="stat.value" class="settle inline-block">{{
              n(stat.value)
            }}</span>
            <span v-else class="skeleton inline-block h-10 w-14 align-middle" />
          </dd>
          <dt class="mt-1 text-sm text-ink-2 sm:text-base">{{ stat.label }}</dt>
        </div>
      </dl>

      <section id="how" aria-labelledby="how-title" class="scroll-mt-20 py-12 sm:py-16">
        <h2 id="how-title" class="text-title">{{ t('about.howTitle') }}</h2>
        <ol class="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="(step, i) in steps" :key="step">
            <span
              class="num flex size-9 items-center justify-center rounded-full border-2 border-brand font-semibold text-brand"
            >
              {{ n(i + 1) }}
            </span>
            <h3 class="mt-3 text-lg">{{ t(`about.how.${step}.title`) }}</h3>
            <p class="mt-1.5 text-[0.9375rem] text-ink-2">{{ t(`about.how.${step}.body`) }}</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="built-title" class="border-t py-12 sm:py-16">
        <div class="grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div>
            <h2 id="built-title" class="text-title">{{ t('about.builtTitle') }}</h2>
            <p class="mt-4 max-w-md text-ink-2">{{ t('about.why1') }}</p>
            <RouterLink :to="{ name: 'about' }" class="link mt-4 inline-block">{{
              t('about.title')
            }}</RouterLink>
          </div>
          <dl class="divide-y divide-line">
            <div v-for="item in built" :key="item" class="py-5 first:pt-0">
              <dt class="text-lg font-medium">{{ t(`about.built.${item}.title`) }}</dt>
              <dd class="mt-1.5 max-w-prose text-ink-2">{{ t(`about.built.${item}.body`) }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  </div>
</template>
