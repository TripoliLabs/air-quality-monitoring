import { createRouter, createWebHistory, type Router, type RouteRecordRaw } from 'vue-router';
import type { IconName } from './components/AppIcon.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key for the document title. */
    title?: string;
    /** The view shows live data and cannot render without the store. */
    needsData?: boolean;
  }
}

/**
 * Primary navigation, in order. Adding a section to the platform is one entry
 * here plus its route below; the header and the mobile tab bar both render
 * from this list.
 */
export const NAV_ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'live', label: 'nav.live', icon: 'live' },
  { name: 'trends', label: 'nav.trends', icon: 'trends' },
  { name: 'network', label: 'nav.network', icon: 'network' },
  { name: 'data', label: 'nav.data', icon: 'data' },
  { name: 'about', label: 'nav.about', icon: 'about' },
];

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  {
    path: '/live',
    name: 'live',
    component: () => import('./views/LiveView.vue'),
    meta: { title: 'nav.live', needsData: true },
  },
  {
    path: '/sensor/:id',
    name: 'sensor',
    component: () => import('./views/SensorView.vue'),
    meta: { title: 'nav.live', needsData: true },
  },
  {
    path: '/neighborhood/:id',
    name: 'neighborhood',
    component: () => import('./views/NeighborhoodView.vue'),
    meta: { title: 'nav.live', needsData: true },
  },
  {
    path: '/trends',
    name: 'trends',
    component: () => import('./views/TrendsView.vue'),
    meta: { title: 'nav.trends', needsData: true },
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('./views/NetworkView.vue'),
    meta: { title: 'nav.network', needsData: true },
  },
  {
    path: '/data',
    name: 'data',
    component: () => import('./views/DataView.vue'),
    meta: { title: 'data.title' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/AboutView.vue'),
    meta: { title: 'about.title' },
  },

  // Addresses from the previous dashboard keep working.
  { path: '/dashboard', redirect: { name: 'live' } },
  { path: '/analytics', redirect: { name: 'trends' } },
  { path: '/health', redirect: { name: 'network' } },
  { path: '/features', redirect: { name: 'about' } },
  { path: '/api-docs', redirect: { name: 'data' } },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
    meta: { title: 'states.notFoundTitle' },
  },
];

/** Sets the tab title for a route; also called when the language changes. */
export function applyTitle(titleKey: string | undefined, t: (key: string) => string): void {
  document.title = titleKey ? `${t(titleKey)} – ${t('app.name')}` : t('app.fullName');
}

export function createAppRouter(i18n: { global: { t: (key: string) => string } }): Router {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior(to, _from, saved) {
      if (saved) return saved;
      if (to.hash) return { el: to.hash, top: 80 };
      return { top: 0 };
    },
  });

  const { t } = i18n.global;
  router.afterEach((to) => applyTitle(to.meta.title, t));

  return router;
}
