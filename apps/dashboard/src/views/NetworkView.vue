<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import AppIcon, { type IconName } from '../components/AppIcon.vue';
import PageHeader from '../components/PageHeader.vue';
import SensorTable from '../components/SensorTable.vue';
import { useLocale } from '../composables/useLocale';
import { batteryPercent } from '../lib/format';
import { useAirStore } from '../stores/air';

/** Below these a node is likely to drop out soon. */
const LOW_BATTERY_PERCENT = 25;
const WEAK_SIGNAL_DBM = -112;

const { t, n, ago, sensorName, sensorPlace } = useLocale();
const store = useAirStore();
const { rows, neighborhoods, ready, now } = storeToRefs(store);

const counts = computed(() => ({
  online: rows.value.filter((row) => row.status === 'online').length,
  offline: rows.value.filter((row) => row.status === 'offline').length,
  inactive: rows.value.filter((row) => row.status === 'inactive').length,
}));

interface Issue {
  id: string;
  name: string;
  place: string;
  icon: IconName;
  text: string;
  /** Sorts the most urgent first. */
  weight: number;
}

const issues = computed((): Issue[] => {
  const list: Issue[] = [];
  for (const row of rows.value) {
    if (row.status === 'inactive') continue; // retired on purpose
    const base = {
      id: row.sensor.id,
      name: sensorName(row.sensor),
      place: sensorPlace(row.sensor),
    };
    if (row.status === 'offline') {
      list.push({
        ...base,
        icon: 'alert',
        text: row.reading
          ? t('network.issueOffline', { ago: ago(row.reading.time, now.value) })
          : t('network.issueNever'),
        weight: 0,
      });
      continue;
    }
    const mv = row.reading?.batteryMv;
    if (mv !== undefined && batteryPercent(mv) < LOW_BATTERY_PERCENT) {
      list.push({
        ...base,
        icon: 'battery',
        text: t('network.issueBattery', { percent: n(batteryPercent(mv)) }),
        weight: 1,
      });
    }
    const dbm = row.reading?.signalStrength;
    if (dbm !== undefined && dbm < WEAK_SIGNAL_DBM) {
      list.push({
        ...base,
        icon: 'signal',
        text: t('network.issueSignal', { dbm: n(dbm) }),
        weight: 2,
      });
    }
  }
  return list.sort((a, b) => a.weight - b.weight);
});
</script>

<template>
  <div class="shell space-y-5 py-4 sm:space-y-7 sm:py-6">
    <PageHeader :title="t('network.title')" :intro="t('network.intro')" />

    <dl class="panel grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse">
      <div
        v-for="item in [
          {
            key: 'online',
            label: t('network.reporting'),
            shape: 'size-2.5 rounded-full bg-[#2FA35B]',
          },
          {
            key: 'offline',
            label: t('network.notReporting'),
            shape: 'size-2.5 rounded-full border-2 border-danger',
          },
          {
            key: 'inactive',
            label: t('network.outOfService'),
            shape: 'h-0.5 w-2.5 rounded bg-ink-3',
          },
        ] as const"
        :key="item.key"
        class="min-w-0 p-4 sm:p-6"
      >
        <dt class="flex items-center gap-2 text-sm text-ink-2">
          <span class="inline-block shrink-0" :class="item.shape" />
          <span class="truncate">{{ item.label }}</span>
        </dt>
        <dd class="num mt-1 text-3xl font-semibold sm:text-4xl">
          <span v-if="ready" :key="counts[item.key]" class="settle inline-block">{{
            n(counts[item.key])
          }}</span>
          <span v-else class="skeleton inline-block h-9 w-12 align-middle" />
        </dd>
      </div>
    </dl>
    <p v-if="ready" class="-mt-2 text-sm text-ink-2">
      {{ t('network.coverage', { count: n(neighborhoods.length) }, neighborhoods.length) }}
    </p>

    <section aria-labelledby="attention-title" class="panel p-5 sm:p-6">
      <h2 id="attention-title" class="mb-2 text-xl">{{ t('network.attentionTitle') }}</h2>
      <div v-if="!ready" class="space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-11" />
      </div>
      <p v-else-if="issues.length === 0" class="flex items-center gap-2 py-2 text-sm text-ink-2">
        <AppIcon name="check" class="text-[#2FA35B]" />
        {{ t('network.attentionNone') }}
      </p>
      <ul v-else class="divide-y divide-line lg:columns-2 lg:gap-10">
        <li v-for="(issue, i) in issues" :key="`${issue.id}-${i}`" class="break-inside-avoid">
          <RouterLink
            :to="{ name: 'sensor', params: { id: issue.id } }"
            class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sunken"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken"
              :class="issue.weight === 0 ? 'text-danger' : 'text-ink-2'"
            >
              <AppIcon :name="issue.icon" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ issue.name }}</span>
              <span class="block truncate text-sm text-ink-2">{{ issue.text }}</span>
            </span>
            <span class="hidden shrink-0 text-sm text-ink-3 sm:block">{{ issue.place }}</span>
            <AppIcon name="chevron" directional class="text-ink-3" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="fleet-title" class="panel p-5 sm:p-6">
      <h2 id="fleet-title" class="mb-4 text-xl">{{ t('network.fleetTitle') }}</h2>
      <div v-if="!ready" class="space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-11" />
      </div>
      <SensorTable v-else :rows="rows" variant="device" :limit="15" />
    </section>
  </div>
</template>
