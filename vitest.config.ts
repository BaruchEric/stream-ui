import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: '.',
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.test.ts',
      'playground/**/*.test.ts',
      'api/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
})
