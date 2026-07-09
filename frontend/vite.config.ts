import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/holdings': 'http://localhost:8000',
    },
  },
})
