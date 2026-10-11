<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import AppTabBar from './components/AppTabBar.vue';
import StateBlock from './components/StateBlock.vue';
import { useLocale } from './composables/useLocale';
import { useAirStore } from './stores/air';

const { t } = useLocale();
const route = useRoute();
const store = useAirStore();

// One connection for the whole app: every page shows the same live picture.
onMounted(() => void store.start());
</script>

<template>
  <a
    href="#content"
    class="sr-only z-50 rounded-control bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
  >
    {{ t('app.skipToContent') }}
  </a>

  <div class="flex min-h-dvh flex-col">
    <!-- Only ever rendered by a development build using the local mock. -->
    <p
      v-if="store.source === 'mock'"
      class="bg-ink px-4 py-1.5 text-center text-xs text-bg"
      :title="t('connection.demoHint')"
    >
      {{ t('connection.demo') }} — {{ t('connection.demoHint') }}
    </p>
    <AppHeader />

    <main id="content" class="flex-1 pb-20 md:pb-0">
      <StateBlock
        v-if="route.meta.needsData && store.error && !store.ready"
        class="mt-10"
        icon="alert"
        tone="danger"
        :title="t('states.errorTitle')"
        :body="t('states.errorBody')"
      >
        <button type="button" class="btn btn-primary" @click="store.retry()">
          {{ t('states.retry') }}
        </button>
      </StateBlock>
      <RouterView v-else />
    </main>

    <AppFooter class="pb-16 md:pb-0" />
    <AppTabBar />
  </div>
</template>
