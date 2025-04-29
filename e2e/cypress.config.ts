import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

import { setupNodeEvents } from './cypress/plugins/database'

dotenv.config()

export default defineConfig({
  e2e: {
    baseUrl: 'http://test.orbitar.local',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    experimentalStudio: true,
    setupNodeEvents,
    env: {
      TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD,
      API_DOMAIN: process.env.API_DOMAIN,
    },
  },
})
