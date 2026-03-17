import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

export default defineConfig({
  // Move Vite cache out of OneDrive to avoid file-locking issues
  cacheDir: path.join(os.tmpdir(), 'vite-erp-station-shipping'),
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/shipping/' : '/',
  server: {
    host: true,
    port: 5182,
    strictPort: true,
    // Allow serving deps from temp cache dir outside workspace
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
});
