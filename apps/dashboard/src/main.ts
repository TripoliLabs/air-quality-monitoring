/**
 * Qalawun dashboard — entry point.
 * License: AGPL-3.0
 */

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { applyLocale, initialLocale } from './composables/usePrefs';
import { createAppI18n } from './i18n';
import { createAppRouter } from './router';

import './style.css';

const locale = initialLocale();
applyLocale(locale);

const i18n = createAppI18n(locale);
const app = createApp(App);

app.use(createPinia());
app.use(i18n);
app.use(createAppRouter(i18n));
app.mount('#app');
