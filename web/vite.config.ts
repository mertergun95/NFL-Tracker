import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages alt dizininde de çalışsın diye göreli base
  base: './',
  resolve: {
    alias: {
      // Bahis takip modülü kendi içinde bu takma adla import eder; böylece
      // dosyaları taşınsa da site kodu ile arasındaki sınır belirgin kalır.
      '@bt': fileURLToPath(new URL('./src/bettracker', import.meta.url)),
    },
  },
})
