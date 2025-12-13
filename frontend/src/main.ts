/**
 * Air Quality Monitoring Dashboard
 * Vue.js Application Entry Point
 *
 * License: AGPL-3.0
 */

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';

import App from './App.vue';
import ar from './i18n/ar';
import en from './i18n/en';
import router from './router';

import './style.css';

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

app.mount('#app');
