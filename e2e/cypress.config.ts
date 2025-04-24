import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://test.orbitar.local',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
  },
})
