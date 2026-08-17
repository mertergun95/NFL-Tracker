import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Testler şimdilik yalnızca bahis takip modülünün saf mantığını kapsıyor
// (oran/settlement/istatistik/yedekleme/senkron); DOM gerekmiyor.
export default defineConfig({
  resolve: {
    alias: {
      '@bt': fileURLToPath(new URL('./src/bettracker', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
