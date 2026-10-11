import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // Same routes nginx serves in production, for `VITE_DATA_SOURCE=api` with
    // no VITE_API_URL: /api/* -> API (prefix stripped), /socket.io -> API.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
  optimizeDeps: {
    include: ['echarts', 'vue-echarts'],
    // Pre-bundling would break the URL MapLibre uses to find its worker module.
    exclude: ['maplibre-gl'],
  },
});
