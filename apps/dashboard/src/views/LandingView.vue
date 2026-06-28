<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ParticleBreeze from '@/components/ParticleBreeze.vue';

const router = useRouter();
const { t, locale } = useI18n();

const isVisible = ref(false);
const statsVisible = ref(false);
const starCount = ref<number | null>(null);

const GITHUB_REPO = 'TripoliLabs/air-quality-monitoring';

onMounted(async () => {
  setTimeout(() => (isVisible.value = true), 100);
  setTimeout(() => (statsVisible.value = true), 600);

  // Fetch GitHub stars
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
    if (response.ok) {
      const data = await response.json();
      starCount.value = data.stargazers_count;
    }
  } catch {
    // Silently fail - stars will just not show
  }
});

function enterDashboard() {
  router.push('/dashboard');
}

function toggleLocale() {
  locale.value = locale.value === 'en' ? 'ar' : 'en';
}

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}
</script>

<template>
  <div
    class="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
  >
    <!-- Particle Effect Background -->
    <ParticleBreeze />

    <!-- Gradient Overlay -->
    <div
      class="absolute inset-0 z-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/40"
    />

    <!-- Accent Glow -->
    <div class="absolute -left-40 top-1/4 z-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
    <div class="absolute -right-40 bottom-1/4 z-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />

    <!-- Content -->
    <div class="relative z-10 flex min-h-screen flex-col">
      <!-- Header -->
      <header class="flex items-center justify-between p-6 md:p-8">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500"
          >
            <svg
              class="h-6 w-6 text-white"
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
          <span class="text-lg font-semibold text-white/90">TripoliLabs</span>
        </div>

        <button
          class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
          @click="toggleLocale"
        >
          {{ locale === 'en' ? 'العربية' : 'English' }}
        </button>
      </header>

      <!-- Hero Section -->
      <main class="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <!-- Project Label -->
        <div
          :class="[
            'mb-6 transform transition-all duration-700',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          ]"
        >
          <span
            class="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400"
          >
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {{ t('landing.openSource') }}
          </span>
        </div>

        <!-- Main Title -->
        <h1
          :class="[
            'transform transition-all delay-100 duration-700',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          ]"
        >
          <span
            class="block text-lg font-medium uppercase tracking-[0.3em] text-white/50 md:text-xl"
          >
            {{ t('landing.project') }}
          </span>
          <span
            class="mt-2 block bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-6xl font-bold tracking-tight text-transparent md:text-8xl"
          >
            Qalawun
          </span>
          <span class="font-arabic mt-1 block text-2xl font-medium text-white/40 md:text-3xl">
            قلاوون
          </span>
        </h1>

        <!-- Tagline -->
        <p
          :class="[
            'mt-8 max-w-2xl text-lg text-white/60 md:text-xl',
            'transform transition-all delay-200 duration-700',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          ]"
        >
          {{ t('landing.tagline') }}
        </p>

        <!-- CTA Buttons -->
        <div
          :class="[
            'mt-10 flex flex-col gap-4 sm:flex-row',
            'transform transition-all delay-300 duration-700',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          ]"
        >
          <button
            class="group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-8 py-4 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
            @click="enterDashboard"
          >
            <span class="relative z-10 flex items-center gap-2">
              {{ t('landing.exploreDashboard') }}
              <svg
                class="h-5 w-5 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div
              class="absolute inset-0 -z-0 bg-gradient-to-r from-emerald-600 to-sky-600 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>

          <a
            :href="`https://github.com/${GITHUB_REPO}`"
            target="_blank"
            class="group flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
              />
            </svg>
            {{ t('landing.viewSource') }}
            <span
              v-if="starCount !== null"
              class="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-sm"
            >
              <svg class="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              {{ formatStarCount(starCount) }}
            </span>
          </a>
        </div>

        <!-- Stats Preview -->
        <div
          :class="[
            'mt-20 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-16',
            'transform transition-all duration-700',
            statsVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          ]"
        >
          <div class="text-center">
            <div class="text-3xl font-bold text-white md:text-4xl">--</div>
            <div class="mt-1 text-sm text-white/50">{{ t('landing.stats.sensors') }}</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-emerald-400 md:text-4xl">--</div>
            <div class="mt-1 text-sm text-white/50">{{ t('landing.stats.aqi') }}</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white md:text-4xl">--</div>
            <div class="mt-1 text-sm text-white/50">{{ t('landing.stats.neighborhoods') }}</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white md:text-4xl">24/7</div>
            <div class="mt-1 text-sm text-white/50">{{ t('landing.stats.monitoring') }}</div>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="p-6 text-center text-sm text-white/30 md:p-8">
        <p>{{ t('landing.footer') }}</p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.font-arabic {
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
}
</style>
