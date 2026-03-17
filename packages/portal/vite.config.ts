import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

export default defineConfig({
  // Move Vite cache out of OneDrive to avoid file-locking issues
  cacheDir: path.join(os.tmpdir(), 'vite-erp-portal'),
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/portal/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    // Allow serving deps from temp cache dir outside workspace
    fs: { strict: false },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
});
