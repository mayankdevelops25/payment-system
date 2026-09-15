import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The app is viewed through the sandbox preview proxy; allow any host.
    allowedHosts: true,
    // Forward API calls to the API gateway. Locally this is the real Spring
    // Cloud Gateway (docker-compose); in this sandbox it is mock-gateway.mjs.
    // Both listen on 8090, so no frontend change is needed to swap them.
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
