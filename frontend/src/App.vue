<script setup lang="ts">
import { getAqiColor, getAqiLabel } from '@composables/useAqi';
import { NEIGHBORHOODS } from '@mock/sensors';
import { useSensorsStore } from '@stores/sensors';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const route = useRoute();
const { t, locale } = useI18n();
const sensorsStore = useSensorsStore();

const GITHUB_REPO = 'TripoliLabs/air-quality-monitoring';
const starCount = ref<number | null>(null);
const moreOpen = ref(false);
const moreDropdownRef = ref<HTMLElement | null>(null);

function toggleMore(): void {
  moreOpen.value = !moreOpen.value;
}

function closeMore(): void {
  moreOpen.value = false;
}

function onClickOutside(e: MouseEvent): void {
  if (
    moreDropdownRef.value &&
    !moreDropdownRef.value.contains(e.target as Node)
  ) {
    moreOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
});

// Full-screen routes without the app shell
const isFullScreenRoute = computed(() => {
  return route.name === 'landing';
});

function toggleLocale(): void {
  locale.value = locale.value === 'en' ? 'ar' : 'en';
  document.documentElement.dir = locale.value === 'ar' ? 'rtl' : 'ltr';
}

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

onMounted(async () => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}`,
    );
    if (response.ok) {
      const data = await response.json();
      starCount.value = data.stargazers_count;
    }
  } catch {
    // Silently fail - stars will just not show
  }
});

// Live AQI badge
const cityAqi = computed(() => sensorsStore.averageAqi);
const aqiColor = computed(() => getAqiColor(cityAqi.value));
const aqiLabel = computed(() => t(getAqiLabel(cityAqi.value)));

// Breadcrumbs
interface Breadcrumb {
  label: string;
  to?: string;
}

const breadcrumbs = computed((): Breadcrumb[] => {
  const name = route.name as string | undefined;
  const crumbs: Breadcrumb[] = [];

  if (name === 'dashboard') {
    crumbs.push({ label: t('nav.dashboard') });
  } else if (name === 'neighborhood') {
    crumbs.push({ label: t('nav.dashboard'), to: '/dashboard' });
    const id = route.params.id as string;
    const neighborhood = NEIGHBORHOODS.find((n) => n.id === id);
    const neighborhoodName =
      locale.value === 'ar'
        ? (neighborhood?.nameAr ?? id)
        : (neighborhood?.name ?? id);
    crumbs.push({ label: neighborhoodName });
  } else if (name === 'sensor-detail') {
    crumbs.push({ label: t('nav.dashboard'), to: '/dashboard' });
    const id = route.params.id as string;
    const sensor = sensorsStore.getSensorById(id);
    const sensorName =
      locale.value === 'ar'
        ? (sensor?.definition.nameAr ?? id)
        : (sensor?.definition.name ?? id);
    crumbs.push({ label: sensorName });
  } else if (name === 'about') {
    crumbs.push({ label: t('nav.about') });
  } else if (name === 'analytics') {
    crumbs.push({ label: t('nav.analytics') });
  } else if (name === 'health') {
    crumbs.push({ label: t('nav.health') });
  } else if (name === 'features') {
    crumbs.push({ label: t('nav.features') });
  } else if (name === 'api-docs') {
    crumbs.push({ label: t('nav.apiDocs') });
  }

  return crumbs;
});
</script>

<template>
  <!-- Full-screen routes (landing page) -->
  <RouterView v-if="isFullScreenRoute" />

  <!-- App shell for dashboard routes -->
  <div v-else class="flex min-h-screen flex-col bg-gray-950">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md">
      <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <!-- Main nav row -->
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center gap-3">
            <RouterLink
              to="/"
              class="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div
                class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500"
              >
                <svg
                  class="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span class="text-lg font-bold tracking-tight text-gray-100">
                Qalawun
              </span>
            </RouterLink>
          </div>

          <!-- Nav links + actions -->
          <div class="flex items-center gap-3">
            <!-- Nav links -->
            <nav class="hidden items-center gap-1 sm:flex">
              <RouterLink
                to="/dashboard"
                class="relative rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.dashboard') }}
              </RouterLink>
              <RouterLink
                to="/analytics"
                class="relative rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.analytics') }}
              </RouterLink>
              <RouterLink
                to="/health"
                class="relative rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.health') }}
              </RouterLink>

              <!-- More dropdown -->
              <div ref="moreDropdownRef" class="relative">
                <button
                  class="relative rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                  @click.stop="toggleMore"
                >
                  {{ t('nav.more') }}
                  <i
                    class="pi pi-chevron-down ml-1 text-xs"
                  ></i>
                </button>
                <div
                  v-if="moreOpen"
                  class="absolute end-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl"
                >
                  <RouterLink
                    to="/features"
                    class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                    @click="closeMore"
                  >
                    {{ t('nav.features') }}
                  </RouterLink>
                  <RouterLink
                    to="/api-docs"
                    class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                    @click="closeMore"
                  >
                    {{ t('nav.apiDocs') }}
                  </RouterLink>
                  <RouterLink
                    to="/about"
                    class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                    @click="closeMore"
                  >
                    {{ t('nav.about') }}
                  </RouterLink>
                </div>
              </div>
            </nav>

            <!-- Divider -->
            <div class="hidden h-5 w-px bg-gray-700 sm:block"></div>

            <!-- GitHub stars badge -->
            <a
              v-if="starCount !== null"
              :href="`https://github.com/${GITHUB_REPO}`"
              target="_blank"
              class="flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-300 transition hover:border-gray-600 hover:bg-gray-700/60"
            >
              <svg
                class="h-3.5 w-3.5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              {{ formatStarCount(starCount) }}
            </a>

            <!-- Language toggle -->
            <button
              class="rounded-lg border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-700/60"
              @click="toggleLocale"
            >
              {{ locale === 'en' ? 'AR' : 'EN' }}
            </button>

            <!-- Live AQI badge -->
            <div
              v-if="cityAqi > 0"
              class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              :style="{
                backgroundColor: aqiColor + '20',
                color: aqiColor,
              }"
            >
              <span
                class="h-2 w-2 rounded-full"
                :style="{ backgroundColor: aqiColor }"
              ></span>
              {{ cityAqi }} {{ aqiLabel }}
            </div>

            <!-- Mobile nav links -->
            <nav class="flex items-center gap-1 sm:hidden">
              <RouterLink
                to="/dashboard"
                class="rounded-md px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.dashboard') }}
              </RouterLink>
              <RouterLink
                to="/analytics"
                class="rounded-md px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.analytics') }}
              </RouterLink>
              <RouterLink
                to="/health"
                class="rounded-md px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.health') }}
              </RouterLink>
              <RouterLink
                to="/about"
                class="rounded-md px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100"
                active-class="!text-emerald-400"
              >
                {{ t('nav.about') }}
              </RouterLink>
            </nav>
          </div>
        </div>

        <!-- Breadcrumbs -->
        <div
          v-if="breadcrumbs.length > 0"
          class="mt-2 flex items-center gap-1.5 text-xs text-gray-500"
        >
          <template v-for="(crumb, index) in breadcrumbs" :key="index">
            <span v-if="index > 0" class="text-gray-600">/</span>
            <RouterLink
              v-if="crumb.to"
              :to="crumb.to"
              class="transition-colors hover:text-gray-300"
            >
              {{ crumb.label }}
            </RouterLink>
            <span v-else class="text-gray-400">{{ crumb.label }}</span>
          </template>
        </div>
      </div>
      <!-- Gradient accent line -->
      <div class="gradient-accent"></div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl py-4 sm:px-6 lg:px-8">
        <RouterView />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900/80 backdrop-blur-md">
      <!-- Gradient accent line -->
      <div class="gradient-accent"></div>

      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <!-- Three-column layout -->
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <!-- Project column -->
          <div>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              {{ t('footer.project') }}
            </h3>
            <div class="mt-3 flex items-center gap-2">
              <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500"
              >
                <svg
                  class="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span class="text-sm font-semibold text-gray-200">
                Project Qalawun
              </span>
            </div>
            <p class="mt-2 text-sm text-gray-500">
              {{ t('footer.tagline') }}
            </p>
            <span
              class="mt-3 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400"
            >
              {{ t('footer.license') }}
            </span>
          </div>

          <!-- Quick Links column -->
          <div>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              {{ t('footer.quickLinks') }}
            </h3>
            <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
              <RouterLink
                to="/dashboard"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.dashboard') }}
              </RouterLink>
              <RouterLink
                to="/features"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.features') }}
              </RouterLink>
              <RouterLink
                to="/analytics"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.analytics') }}
              </RouterLink>
              <RouterLink
                to="/api-docs"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.apiDocs') }}
              </RouterLink>
              <RouterLink
                to="/health"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.health') }}
              </RouterLink>
              <RouterLink
                to="/about"
                class="text-sm text-gray-500 transition hover:text-emerald-400"
              >
                {{ t('nav.about') }}
              </RouterLink>
            </div>
          </div>

          <!-- Community column -->
          <div>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              {{ t('footer.community') }}
            </h3>
            <ul class="mt-3 space-y-2">
              <li>
                <a
                  :href="`https://github.com/${GITHUB_REPO}`"
                  target="_blank"
                  class="text-sm text-gray-500 transition hover:text-emerald-400"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/TripoliLabs"
                  target="_blank"
                  class="text-sm text-gray-500 transition hover:text-emerald-400"
                >
                  TripoliLabs
                </a>
              </li>
              <li>
                <a
                  href="https://openaq.org"
                  target="_blank"
                  class="text-sm text-gray-500 transition hover:text-emerald-400"
                >
                  OpenAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        <!-- Copyright bar -->
        <div class="mt-8 border-t border-gray-800 pt-4">
          <p class="text-center text-xs text-gray-600">
            {{ t('footer.copyright') }}
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Component-specific styles */
</style>
