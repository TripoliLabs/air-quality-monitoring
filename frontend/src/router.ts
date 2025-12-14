/**
 * Vue Router Configuration
 * Project Qalawun - Air Quality Monitoring for Tripoli
 */

import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('./views/LandingView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/sensor/:id',
      name: 'sensor-detail',
      component: () => import('./views/SensorDetailView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./views/AboutView.vue'),
    },
  ],
});

export default router;
