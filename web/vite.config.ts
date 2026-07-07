import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages alt dizininde de çalışsın diye göreli base
  base: './',
})
