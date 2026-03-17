import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

export default defineConfig(({ command }) => ({
  cacheDir: path.join(os.tmpdir(), 'vite-erp-shop-floor'),
  plugins: [react()],
  // Default '/' for Tauri bundled mode and dev.
  // Set VITE_BASE_PATH=/shop-floor/ when building for server-hosted dev mode.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5186,
    strictPort: true,
    fs: { strict: false },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}));
