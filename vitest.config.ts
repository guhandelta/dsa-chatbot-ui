import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    environment: 'jsdom',
    globals: true,
    // Shared setup: see src/test/setup.ts for the async query timeout.
    setupFiles: ['./src/test/setup.ts'],
    // Under coverage instrumentation the Study Room tests render large trees and can take
    // several seconds each. 20 seconds still stops a real hang quickly.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/routeTree.gen.ts', 'src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
})
