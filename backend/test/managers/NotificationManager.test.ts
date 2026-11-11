import NotificationManager from '../../src/managers/NotificationManager'

// --- Mock factories ---

function createMockNotificationsRepository() {
  return {
    muteUser: jest.fn().mockResolvedValue(undefined),
    unmuteUser: jest.fn().mockResolvedValue(undefined),
    isMuted: jest.fn().mockResolvedValue(false),
    getMutedUserIds: jest.fn().mockResolvedValue([]),
  }
}

function createMockUserCache() {
  return {
    getById: jest.fn(),
    deleteUserStatsCache: jest.fn(),
  }
}

function createMockLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
  }
}

function createManager(overrides: Record<string, any> = {}) {
  const notificationsRepository = overrides.notificationsRepository || createMockNotificationsRepository()
  const userCache = overrides.userCache || createMockUserCache()
  const logger = createMockLogger()

  const manager = new NotificationManager(
    {} as any, // commentRepository
    notificationsRepository as any,
    {} as any, // postRepository
    userCache as any,
    {} as any, // siteRepository
    (() => ({})) as any, // siteManagerLazy
    {} as any, // webPushRepository
    {} as any, // vapidConfig (empty -> web push disabled)
    {} as any, // siteConfig
    logger as any,
  )

  return { manager, notificationsRepository, userCache, logger }
}

// --- Tests ---

describe('NotificationManager mute', () => {
  describe('muteUser', () => {
    it('should refuse to mute yourself and not touch the repository', async () => {
      const { manager, notificationsRepository, userCache } = createManager()

      const result = await manager.muteUser(10, 10)

      expect(result).toBe(false)
      expect(notificationsRepository.muteUser).not.toHaveBeenCalled()
      expect(userCache.deleteUserStatsCache).not.toHaveBeenCalled()
    })

    it('should persist the mute and invalidate the recipient stats cache', async () => {
      const { manager, notificationsRepository, userCache } = createManager()

      const result = await manager.muteUser(10, 20)

      expect(result).toBe(true)
      expect(notificationsRepository.muteUser).toHaveBeenCalledWith(10, 20)
      // Unread/visible badge counts change, so the cache must be dropped.
      expect(userCache.deleteUserStatsCache).toHaveBeenCalledWith(10)
    })
  })

  describe('unmuteUser', () => {
    it('should remove the mute and invalidate the stats cache', async () => {
      const { manager, notificationsRepository, userCache } = createManager()

      await manager.unmuteUser(10, 20)

      expect(notificationsRepository.unmuteUser).toHaveBeenCalledWith(10, 20)
      expect(userCache.deleteUserStatsCache).toHaveBeenCalledWith(10)
    })
  })

  describe('isMuted', () => {
    it('should delegate to the repository', async () => {
      const notificationsRepository = createMockNotificationsRepository()
      notificationsRepository.isMuted.mockResolvedValue(true)
      const { manager } = createManager({ notificationsRepository })

      await expect(manager.isMuted(10, 20)).resolves.toBe(true)
      expect(notificationsRepository.isMuted).toHaveBeenCalledWith(10, 20)
    })
  })

  describe('getMutedUsers', () => {
    it('should expand muted ids to user info and skip missing users', async () => {
      const notificationsRepository = createMockNotificationsRepository()
      notificationsRepository.getMutedUserIds.mockResolvedValue([20, 30, 40])

      const userCache = createMockUserCache()
      userCache.getById.mockImplementation(async (id: number) => {
        if (id === 30) {
          return undefined // deleted / unknown user, should be skipped
        }
        return { id, username: `user${id}`, gender: 1, extra: 'ignored' }
      })

      const { manager } = createManager({ notificationsRepository, userCache })

      const users = await manager.getMutedUsers(10)

      expect(users).toEqual([
        { id: 20, username: 'user20', gender: 1 },
        { id: 40, username: 'user40', gender: 1 },
      ])
    })
  })
})
