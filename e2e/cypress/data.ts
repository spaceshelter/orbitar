const userTypes = ['fullrights', 'norights', 'lowkarma', 'wrong'] as const

interface TestUser {
  username: string
  password: string
}

export const testUsers: Record<(typeof userTypes)[number], TestUser> = {
  fullrights: {
    username: 'testuser1',
    password: 'testpass1',
  },
  norights: {
    username: 'testuser2',
    password: 'testpass2',
  },
  lowkarma: {
    username: 'testuser3',
    password: 'testpass3',
  },
  wrong: {
    username: 'wronguser',
    password: 'wrongpass',
  },
}
