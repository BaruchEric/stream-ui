import { defineConfig } from 'vite'

export default defineConfig({
  root: 'playground',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PLAYGROUND_SERVER_PORT ?? 3030}`,
        changeOrigin: true,
      },
    },
  },
})
