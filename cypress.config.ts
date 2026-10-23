/**
 * Cypress end-to-end configuration.
 *
 * The specs run against the Vite dev server (`npm run dev`, port 3000) and stub
 * every API call with cy.intercept, so the tests need no backend, no database and
 * no sandbox. That keeps them deterministic. Run them with `npm run e2e`
 * (headless) or `npm run e2e:open` (interactive).
 */
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
  },
})
