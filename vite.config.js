import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const { PORT = '3000' } = loadEnv(mode, 'server', 'PORT')
  const target = `http://localhost:${PORT}`
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
        '/health': {
          target,
          changeOrigin: true,
        },
        '/auth': {
          target,
          changeOrigin: true,
        },
        '/events': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
