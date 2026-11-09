import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      thresholds: { statements: 55, branches: 48, functions: 43, lines: 57 },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
