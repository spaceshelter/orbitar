import path from 'path'

const userTypes = ['fullrights', 'norights', 'lowkarma', 'wrong'] as const

interface TestUser {
  username: string
  password: string
}

export const testUsers: Record<(typeof userTypes)[number], TestUser> = {
  fullrights: {
    username: 'testuser1',
    password: Cypress.env('TEST_USER_PASSWORD') ?? '',
  },
  norights: {
    username: 'testuser2',
    password: Cypress.env('TEST_USER_PASSWORD') ?? '',
  },
  lowkarma: {
    username: 'testuser3',
    password: Cypress.env('TEST_USER_PASSWORD') ?? '',
  },
  wrong: {
    username: 'wronguser',
    password: 'wrongpass',
  },
}
