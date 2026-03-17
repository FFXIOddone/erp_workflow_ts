import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import os from 'os'

export default defineConfig({
  // Move Vite cache out of OneDrive to avoid file-locking issues
  cacheDir: path.join(os.tmpdir(), 'vite-erp-slip-sort'),
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5185,
    strictPort: true,
    // Allow serving deps from temp cache dir outside workspace
    fs: { strict: false },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
