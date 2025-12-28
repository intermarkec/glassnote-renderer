import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  publicDir: 'public',
  base: './', // Use relative paths for Electron
  server: {
    port: 5173,
    host: true,
    open: false, // Don't open browser automatically
    hmr: true
  }
})