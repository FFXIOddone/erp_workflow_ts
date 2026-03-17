import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

export default defineConfig({
  plugins: [react()],
  // Move Vite's dep cache out of OneDrive — OneDrive locks files during sync,
  // preventing Vite's atomic rename of deps_temp → deps
  cacheDir: path.join(os.tmpdir(), 'vite-erp-web'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-virtual', 'zustand'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      'zustand',
      'axios',
      'clsx',
      'lucide-react',
      'react-hot-toast',
      'date-fns',
      'tailwind-merge',
      'qrcode.react',
    ],
  },
  server: {
    port: 5173,
    host: true, // Expose to all network interfaces (0.0.0.0)
    allowedHosts: ['localhost', '.ngrok-free.dev', '.ngrok.io', '.loca.lt'],
    fs: {
      // Allow serving deps from temp cache dir outside workspace
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-virtual'],
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'clsx', 'tailwind-merge'],
          'vendor-utils': ['axios', 'date-fns', 'zustand', 'zod'],
          // framer-motion excluded from vendor chunks — lazy-loaded with pages that use it
        },
      },
    },
  },
});
