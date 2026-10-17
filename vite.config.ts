import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Dev: forward API calls to the Spring Boot store (same trick as the store admin: drop the Origin
// header, otherwise the backend answers 403 "Invalid CORS request").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // the shared design tokens live in the store repository, next to this project
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: process.env.STORE_API_URL ?? 'http://localhost:8080',
        configure: (proxy) => {
          proxy.on('proxyReq', (request) => request.removeHeader('origin'))
        },
      },
    },
  },
  test: { environment: 'node' },
})
