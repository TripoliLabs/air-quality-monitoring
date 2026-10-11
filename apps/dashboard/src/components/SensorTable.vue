<script setup lang="ts">
/**
 * The sensor list. A sortable table from tablet width up; a compact list of
 * rows on a phone, where a seven-column table cannot be read. Both are fed by
 * the same sorted, filtered rows, and both update in place as readings arrive.
 */
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLocale } from '../composables/useLocale';
import { useSort } from '../composables/useSort';
import { batteryPercent } from '../lib/format';
import type { SensorRow } from '../lib/stats';
import { useAirStore } from '../stores/air';
import AppIcon from './AppIcon.vue';
import AqiChip from './AqiChip.vue';
import StatusLabel from './StatusLabel.vue';

type SortKey =
  | 'name'
  | 'place'
  | 'aqi'
  | 'pm25'
  | 'pm10'
  | 'temperature'
  | 'humidity'
  | 'battery'
  | 'signal'
  | 'seen'
  | 'status';

const props = withDefaults(
  defineProps<{
    rows: SensorRow[];
    /** `air` shows measurements; `device` shows battery, signal and last contact. */
    variant?: 'air' | 'device';
    hidePlace?: boolean;
    searchable?: boolean;
    /** Show this many rows until the reader asks for all of them. */
    limit?: number;
  }>(),
  { variant: 'air', hidePlace: false, searchable: true, limit: 0 },
);

const router = useRouter();
const { t, n, metricValue, metricUnit, ago, sensorName, sensorPlace } = useLocale();
const { now } = storeToRefs(useAirStore());

const query = ref('');
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter(({ sensor }) =>
    [sensor.name, sensor.nameAr, sensor.neighborhood, sensor.neighborhoodAr, sensor.id].some(
      (field) => field?.toLowerCase().includes(q),
    ),
  );
});

const STATUS_ORDER = { offline: 0, inactive: 1, online: 2 } as const;
const { sorted, key, descending, toggle, ariaSort } = useSort<SensorRow, SortKey>(
  () => filtered.value,
  {
    name: (r) => sensorName(r.sensor),
    place: (r) => sensorPlace(r.sensor),
    aqi: (r) => (r.status === 'online' ? r.reading?.aqi : null),
    pm25: (r) => (r.status === 'online' ? r.reading?.pm25 : null),
    pm10: (r) => (r.status === 'online' ? r.reading?.pm10 : null),
    temperature: (r) => (r.status === 'online' ? r.reading?.temperature : null),
    humidity: (r) => (r.status === 'online' ? r.reading?.humidity : null),
    battery: (r) => r.reading?.batteryMv,
    signal: (r) => r.reading?.signalStrength,
    seen: (r) => r.reading?.time,
    status: (r) => STATUS_ORDER[r.status],
  },
  props.variant === 'air' ? 'aqi' : 'status',
  props.variant === 'air',
);

interface Column {
  key: SortKey;
  label: string;
  numeric?: boolean;
}

const columns = computed((): Column[] => {
  const lead: Column[] = [{ key: 'name', label: t('sensors.name') }];
  if (!props.hidePlace) lead.push({ key: 'place', label: t('sensors.neighborhood') });
  if (props.variant === 'device') {
    return [
      ...lead,
      { key: 'status', label: t('sensors.status') },
      { key: 'seen', label: t('sensors.lastSeen') },
      { key: 'battery', label: t('sensor.battery'), numeric: true },
      { key: 'signal', label: t('sensor.signal'), numeric: true },
    ];
  }
  return [
    ...lead,
    { key: 'aqi', label: t('aqi.label') },
    { key: 'pm25', label: t('metrics.pm25.short'), numeric: true },
    { key: 'pm10', label: t('metrics.pm10.short'), numeric: true },
    { key: 'temperature', label: t('metrics.temperature.name'), numeric: true },
    { key: 'humidity', label: t('metrics.humidity.name'), numeric: true },
    { key: 'seen', label: t('sensors.lastSeen') },
  ];
});

const showAll = ref(false);
/** A search always looks through everything; otherwise the list starts short. */
const visible = computed(() =>
  props.limit && !showAll.value && !query.value.trim()
    ? sorted.value.slice(0, props.limit)
    : sorted.value,
);
const hiddenCount = computed(() => sorted.value.length - visible.value.length);

const live = (row: SensorRow): boolean => row.status === 'online' && row.reading !== null;
const seen = (row: SensorRow): string =>
  row.reading ? ago(row.reading.time, now.value) : t('sensors.never');

function open(row: SensorRow): void {
  void router.push({ name: 'sensor', params: { id: row.sensor.id } });
}
</script>

<template>
  <div>
    <div v-if="searchable" class="mb-4 flex flex-wrap items-center gap-3">
      <label class="relative block min-w-0 flex-1 sm:max-w-xs">
        <span class="sr-only">{{ t('sensors.search') }}</span>
        <AppIcon
          name="search"
          class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="t('sensors.search')"
          class="h-11 w-full rounded-control border bg-surface ps-10 pe-3 text-sm placeholder:text-ink-3 focus-visible:border-brand"
        />
      </label>

      <!-- Sorting on a phone, where there are no column headers to press. -->
      <label class="md:hidden">
        <span class="sr-only">{{ t('sensors.sortBy', { column: '' }) }}</span>
        <select
          :value="key"
          class="h-11 rounded-control border bg-surface px-3 text-sm"
          @change="toggle(($event.target as HTMLSelectElement).value as SortKey)"
        >
          <option v-for="column in columns" :key="column.key" :value="column.key">
            {{ t('sensors.sortBy', { column: column.label }) }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="sorted.length === 0" class="py-8 text-center text-sm text-ink-2">
      {{ t('sensors.noMatch', { query }) }}
    </p>

    <!-- Phone: rows -->
    <ul v-if="sorted.length" class="divide-y divide-line md:hidden">
      <li v-for="row in visible" :key="row.sensor.id">
        <RouterLink
          :to="{ name: 'sensor', params: { id: row.sensor.id } }"
          class="flex items-center gap-3 py-3"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ sensorName(row.sensor) }}</p>
            <p class="truncate text-sm text-ink-2">
              <template v-if="variant === 'device' || !live(row)">
                <StatusLabel v-if="!live(row)" :status="row.status" />
                <span v-else>{{ seen(row) }}</span>
              </template>
              <template v-else-if="!hidePlace">{{ sensorPlace(row.sensor) }}</template>
              <template v-else>{{ seen(row) }}</template>
            </p>
          </div>
          <template v-if="variant === 'air'">
            <span v-if="live(row)" class="text-end text-xs leading-tight text-ink-2">
              <span class="num block text-sm text-ink">{{
                metricValue('pm25', row.reading?.pm25)
              }}</span>
              {{ t('metrics.pm25.short') }}
            </span>
            <AqiChip v-if="live(row)" :aqi="row.reading?.aqi" />
          </template>
          <span
            v-else-if="row.reading?.batteryMv !== undefined"
            class="text-end text-xs leading-tight text-ink-2"
          >
            <span class="num block text-sm text-ink"
              >{{ n(batteryPercent(row.reading.batteryMv)) }}%</span
            >
            {{ t('sensor.battery') }}
          </span>
          <AppIcon name="chevron" directional class="text-ink-3" />
        </RouterLink>
      </li>
    </ul>

    <!-- Tablet and up: table -->
    <div v-if="sorted.length" class="hidden overflow-x-auto md:block">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="py-2 pe-4 font-normal whitespace-nowrap text-ink-2 last:pe-0"
              :class="column.numeric ? 'text-end' : 'text-start'"
              :aria-sort="ariaSort(column.key)"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded py-1 hover:text-ink"
                :class="{ 'font-medium text-ink': key === column.key }"
                :aria-label="t('sensors.sortBy', { column: column.label })"
                @click="toggle(column.key)"
              >
                {{ column.label }}
                <AppIcon
                  :name="key === column.key ? 'chevron' : 'sort'"
                  class="text-xs"
                  :class="
                    key === column.key ? (descending ? 'rotate-90' : '-rotate-90') : 'opacity-50'
                  "
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in visible"
            :key="row.sensor.id"
            class="cursor-pointer transition-colors hover:bg-sunken/70"
            @click="open(row)"
          >
            <th scope="row" class="py-3 pe-4 text-start font-medium">
              <RouterLink :to="{ name: 'sensor', params: { id: row.sensor.id } }" @click.stop>
                {{ sensorName(row.sensor) }}
              </RouterLink>
            </th>
            <td v-if="!hidePlace" class="py-3 pe-4 text-ink-2">{{ sensorPlace(row.sensor) }}</td>

            <template v-if="variant === 'air'">
              <td class="py-3 pe-4">
                <AqiChip v-if="live(row)" :aqi="row.reading?.aqi" label />
                <StatusLabel v-else :status="row.status" />
              </td>
              <td class="num py-3 pe-4 text-end">
                {{ live(row) ? metricValue('pm25', row.reading?.pm25) : '–' }}
              </td>
              <td class="num py-3 pe-4 text-end">
                {{ live(row) ? metricValue('pm10', row.reading?.pm10) : '–' }}
              </td>
              <td class="py-3 pe-4 text-end whitespace-nowrap">
                <span class="num">{{
                  live(row) ? metricValue('temperature', row.reading?.temperature) : '–'
                }}</span>
                <span v-if="live(row)" class="text-ink-3"> {{ metricUnit('temperature') }}</span>
              </td>
              <td class="py-3 pe-4 text-end whitespace-nowrap">
                <span class="num">{{
                  live(row) ? metricValue('humidity', row.reading?.humidity) : '–'
                }}</span>
                <span v-if="live(row)" class="text-ink-3">{{ metricUnit('humidity') }}</span>
              </td>
              <td class="py-3 whitespace-nowrap" :class="live(row) ? 'text-ink-2' : 'text-danger'">
                {{ seen(row) }}
              </td>
            </template>

            <template v-else>
              <td class="py-3 pe-4"><StatusLabel :status="row.status" /></td>
              <td class="py-3 pe-4 whitespace-nowrap text-ink-2">{{ seen(row) }}</td>
              <td class="py-3 pe-4 text-end whitespace-nowrap">
                <template v-if="row.reading?.batteryMv !== undefined">
                  <span class="num">{{ n(batteryPercent(row.reading.batteryMv)) }}%</span>
                  <span class="num ms-2 text-xs text-ink-3"
                    >{{ n(row.reading.batteryMv / 1000, 2) }} V</span
                  >
                </template>
                <template v-else>–</template>
              </td>
              <td class="py-3 text-end whitespace-nowrap">
                <template v-if="row.reading?.signalStrength !== undefined">
                  <span class="num">{{ n(row.reading.signalStrength) }}</span>
                  <span class="ms-1 text-ink-3">{{ t('units.dbm') }}</span>
                </template>
                <template v-else>–</template>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      v-if="hiddenCount > 0"
      type="button"
      class="btn btn-quiet mt-4 w-full sm:w-auto"
      @click="showAll = true"
    >
      {{ t('sensors.showAll', { count: n(sorted.length) }) }}
    </button>
  </div>
</template>
