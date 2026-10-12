<script setup lang="ts">
import StateBlock from '../components/StateBlock.vue';
import { useLocale } from '../composables/useLocale';

const { t } = useLocale();
</script>

<template>
  <div class="shell py-10">
    <StateBlock icon="pin" :title="t('states.notFoundTitle')" :body="t('states.notFoundBody')">
      <RouterLink :to="{ name: 'live' }" class="btn btn-primary">{{
        t('states.goLive')
      }}</RouterLink>
    </StateBlock>
  </div>
</template>
