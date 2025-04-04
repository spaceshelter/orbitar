import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  e2e: {
    baseUrl: 'http://orbitar.local',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      username: process.env.CYPRESS_USERNAME,
      password: process.env.CYPRESS_PASSWORD,
    },
  },
})
