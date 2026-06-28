import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@i18n': resolve(__dirname, 'src/i18n'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@composables': resolve(__dirname, 'src/composables'),
      '@mock': resolve(__dirname, 'src/mock'),
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
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['echarts', 'vue-echarts'],
  },
});
