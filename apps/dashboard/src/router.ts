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
      path: '/neighborhood/:id',
      name: 'neighborhood',
      component: () => import('./views/NeighborhoodView.vue'),
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
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('./views/AnalyticsView.vue'),
    },
    {
      path: '/health',
      name: 'health',
      component: () => import('./views/HealthView.vue'),
    },
    {
      path: '/features',
      name: 'features',
      component: () => import('./views/FeaturesView.vue'),
    },
    {
      path: '/api-docs',
      name: 'api-docs',
      component: () => import('./views/ApiDocsView.vue'),
    },
  ],
});

export default router;
