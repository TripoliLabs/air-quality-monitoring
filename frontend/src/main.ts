/**
 * Air Quality Monitoring Dashboard
 * Vue.js Application Entry Point
 *
 * License: AGPL-3.0
 */

import Aura from '@primevue/themes/aura';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import VChart from 'vue-echarts';
import { createI18n } from 'vue-i18n';

import App from './App.vue';
import ar from './i18n/ar';
import en from './i18n/en';
import router from './router';

import './style.css';

// Tree-shake ECharts: register only what we need
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
]);

// Ensure dark mode class is on the document
document.documentElement.classList.add('dark');

// Create i18n instance
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    ar,
  },
});

// Create and mount app
const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
});

// Register VChart globally
app.component('VChart', VChart);

app.mount('#app');
