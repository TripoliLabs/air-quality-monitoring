<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  method: 'GET' | 'POST' | 'WS';
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  exampleResponse?: string;
}>();

const expanded = ref(false);

const methodColors: Record<string, string> = {
  GET: 'bg-green-600',
  POST: 'bg-blue-600',
  WS: 'bg-purple-600',
};
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-gray-700">
    <!-- Header -->
    <button
      class="flex w-full items-center gap-3 bg-gray-800/60 px-4 py-3 text-left transition hover:bg-gray-800"
      @click="expanded = !expanded"
    >
      <span class="rounded px-2 py-0.5 text-xs font-bold text-white" :class="methodColors[method]">
        {{ method }}
      </span>
      <code class="flex-1 text-sm font-medium text-gray-200">{{ path }}</code>
      <span class="text-xs text-gray-400">{{ description }}</span>
      <i
        class="pi text-xs text-gray-500 transition-transform"
        :class="expanded ? 'pi-chevron-up' : 'pi-chevron-down'"
      ></i>
    </button>

    <!-- Expanded content -->
    <div v-if="expanded" class="border-t border-gray-700 bg-gray-900/60 p-4">
      <!-- Parameters table -->
      <div v-if="params && params.length > 0" class="mb-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-left text-xs text-gray-400">
              <th class="pb-2 pr-4">{{ t('apiDocs.parameter') }}</th>
              <th class="pb-2 pr-4">{{ t('apiDocs.type') }}</th>
              <th class="pb-2 pr-4">{{ t('apiDocs.required') }}</th>
              <th class="pb-2">{{ t('apiDocs.description') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="param in params" :key="param.name" class="border-b border-gray-800">
              <td class="py-2 pr-4">
                <code class="text-emerald-400">{{ param.name }}</code>
              </td>
              <td class="py-2 pr-4 text-gray-400">{{ param.type }}</td>
              <td class="py-2 pr-4">
                <span class="text-xs" :class="param.required ? 'text-amber-400' : 'text-gray-500'">
                  {{ param.required ? t('apiDocs.yes') : t('apiDocs.no') }}
                </span>
              </td>
              <td class="py-2 text-gray-300">{{ param.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Example response -->
      <div v-if="exampleResponse">
        <p class="mb-2 text-xs font-semibold text-gray-400">
          {{ t('apiDocs.exampleResponse') }}
        </p>
        <pre
          class="overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-300"
        ><code>{{ exampleResponse }}</code></pre>
      </div>
    </div>
  </div>
</template>
