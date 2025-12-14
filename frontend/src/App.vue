<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Full-screen routes without the app shell
const isFullScreenRoute = computed(() => {
  return route.name === 'landing';
});
</script>

<template>
  <!-- Full-screen routes (landing page) -->
  <RouterView v-if="isFullScreenRoute" />

  <!-- App shell for dashboard routes -->
  <div v-else class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <RouterLink to="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
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
              <div>
                <h1 class="text-xl font-bold tracking-tight text-gray-900">Project Qalawun</h1>
                <p class="text-xs text-gray-500">Air Quality Monitor - Tripoli</p>
              </div>
            </RouterLink>
          </div>
          <nav class="flex items-center gap-4">
            <RouterLink
              to="/dashboard"
              class="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              active-class="text-emerald-600"
            >
              Dashboard
            </RouterLink>
            <RouterLink
              to="/about"
              class="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              active-class="text-emerald-600"
            >
              About
            </RouterLink>
          </nav>
        </div>
      </div>
    </header>
    <main>
      <div class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Component-specific styles */
</style>
