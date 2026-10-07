import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@components': resolve(import.meta.dirname, 'src/components'),
      '@views': resolve(import.meta.dirname, 'src/views'),
      '@i18n': resolve(import.meta.dirname, 'src/i18n'),
      '@stores': resolve(import.meta.dirname, 'src/stores'),
      '@composables': resolve(import.meta.dirname, 'src/composables'),
      '@mock': resolve(import.meta.dirname, 'src/mock'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['echarts', 'vue-echarts'],
  },
});
