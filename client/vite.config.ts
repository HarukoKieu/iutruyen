/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '')
  const socketOrigin = env.VITE_SOCKET_URL || new URL(apiBase).origin

  return {
  server: {
    proxy: {
      '/api/v1': {
        target: apiBase,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/v1/, ''),
      },
      '/socket.io': {
        target: socketOrigin,
        changeOrigin: true,
        ws: true,
      },
      '/seo/covers/': {
        target: apiBase,
        changeOrigin: true,
      },
    },
  },
  ssr: { noExternal: ['next-themes', 'sonner'] },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      thresholds: { statements: 50, branches: 48, functions: 41, lines: 51 },
    },
  },
  }
})
