<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import PageHeader from '../components/PageHeader.vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import { AQI_CATEGORIES } from '../lib/aqi';

const { t, n } = useLocale();
const aqi = useAqi();
const REPO = 'https://github.com/TripoliLabs/air-quality-monitoring';

const steps = ['measure', 'send', 'process', 'show'] as const;
const built = ['solar', 'radio', 'open'] as const;
const measures = ['pm25', 'pm10', 'temperature', 'humidity'] as const;
const hardware = ['board', 'particles', 'climate', 'power'] as const;
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <PageHeader :title="t('about.title')" :intro="t('about.lede')" />

    <div class="grid gap-x-12 gap-y-10 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="why-title" class="max-w-prose">
        <h2 id="why-title" class="text-2xl">{{ t('about.whyTitle') }}</h2>
        <p class="mt-4">{{ t('about.why1') }}</p>
        <p class="mt-3">{{ t('about.why2') }}</p>

        <h2 class="mt-10 text-2xl">{{ t('about.measureTitle') }}</h2>
        <dl class="mt-3 divide-y divide-line">
          <div v-for="id in measures" :key="id" class="py-3">
            <dt class="font-medium">
              {{ t(`metrics.${id}.name`) }}
              <span v-if="id.startsWith('pm')" class="font-normal text-ink-3">{{
                t(`metrics.${id}.short`)
              }}</span>
            </dt>
            <dd class="mt-1 text-[0.9375rem] text-ink-2">{{ t(`about.measure.${id}`) }}</dd>
          </div>
        </dl>
      </section>

      <section id="scale" aria-labelledby="scale-title" class="panel self-start p-5 sm:p-6">
        <h2 id="scale-title" class="text-2xl">{{ t('about.scaleTitle') }}</h2>
        <p class="mt-2 text-[0.9375rem] text-ink-2">{{ t('about.scaleIntro') }}</p>
        <ol class="mt-4 divide-y divide-line">
          <li v-for="category in AQI_CATEGORIES" :key="category.id" class="flex gap-4 py-3.5">
            <span
              class="num flex h-9 w-16 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
              :style="{
                backgroundColor: category.solid,
                color: category.onSolid,
                boxShadow: 'inset 0 0 0 1px rgb(12 34 49 / 0.18)',
              }"
              dir="ltr"
            >
              {{
                category.id === 'hazardous'
                  ? `${n(category.min)}+`
                  : `${n(category.min)}–${n(category.max)}`
              }}
            </span>
            <div class="min-w-0">
              <p class="font-medium" :style="{ color: aqi.text(category.min) }">
                {{ t(`aqi.names.${category.id}`) }}
              </p>
              <p class="text-[0.9375rem] text-ink-2">{{ t(`aqi.advice.${category.id}`) }}</p>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <section id="how" aria-labelledby="how-title" class="border-t pt-10">
      <h2 id="how-title" class="text-2xl">{{ t('about.howTitle') }}</h2>
      <ol class="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
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

    <section aria-labelledby="built-title" class="border-t pt-10">
      <h2 id="built-title" class="text-2xl">{{ t('about.builtTitle') }}</h2>
      <div class="mt-6 grid gap-x-8 gap-y-8 lg:grid-cols-3">
        <div v-for="item in built" :key="item">
          <h3 class="text-lg">{{ t(`about.built.${item}.title`) }}</h3>
          <p class="mt-1.5 text-[0.9375rem] text-ink-2">{{ t(`about.built.${item}.body`) }}</p>
        </div>
      </div>
    </section>

    <div class="grid gap-x-12 gap-y-10 border-t pt-10 lg:grid-cols-2">
      <section aria-labelledby="hardware-title">
        <h2 id="hardware-title" class="text-2xl">{{ t('about.hardwareTitle') }}</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="part in hardware" :key="part" class="py-3">
            {{ t(`about.hardware.${part}`) }}
          </li>
        </ul>
        <h3 class="mt-8 text-lg">{{ t('about.limitsTitle') }}</h3>
        <p class="mt-1.5 max-w-prose text-[0.9375rem] text-ink-2">{{ t('about.limits') }}</p>
      </section>

      <section aria-labelledby="contribute-title">
        <h2 id="contribute-title" class="text-2xl">{{ t('about.contributeTitle') }}</h2>
        <p class="mt-3 max-w-prose">{{ t('about.contributeBody') }}</p>
        <div class="mt-5 flex flex-wrap gap-3">
          <a :href="REPO" target="_blank" rel="noopener" class="btn btn-primary">
            {{ t('about.github') }}
            <AppIcon name="external" />
          </a>
          <RouterLink :to="{ name: 'data' }" class="btn btn-quiet">{{
            t('data.title')
          }}</RouterLink>
        </div>
        <h3 class="mt-8 text-lg">{{ t('about.nameTitle') }}</h3>
        <p class="mt-1.5 max-w-prose text-[0.9375rem] text-ink-2">{{ t('about.nameBody') }}</p>
      </section>
    </div>
  </div>
</template>
