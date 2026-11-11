import NotificationsController from '../../src/api/NotificationsController'

// --- Mock factories ---

function createMockNotificationManager() {
  return {
    getNotifications: jest.fn().mockResolvedValue([]),
    setRead: jest.fn().mockResolvedValue(undefined),
    setReadAndHidden: jest.fn().mockResolvedValue(undefined),
    setReadAll: jest.fn().mockResolvedValue(undefined),
    setHiddenAll: jest.fn().mockResolvedValue(undefined),
    muteUser: jest.fn().mockResolvedValue(true),
    unmuteUser: jest.fn().mockResolvedValue(undefined),
    isMuted: jest.fn().mockResolvedValue(false),
    getMutedUsers: jest.fn().mockResolvedValue([{ id: 20, username: 'spammer', gender: 1 }]),
  }
}

function createMockUserManager() {
  return {
    getById: jest.fn().mockResolvedValue({ id: 20, username: 'spammer', gender: 1 }),
    getPushSubscription: jest.fn().mockResolvedValue(undefined),
  }
}

function createMockOauth() {
  return jest.fn().mockReturnValue((_req, _res, next) => next())
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

function createMockRequest(userId: number, body: Record<string, unknown> = {}) {
  return {
    session: {
      data: { userId },
    },
    body,
  } as any
}

function createMockResponse() {
  const res: any = {
    success: jest.fn(),
    error: jest.fn(),
    authRequired: jest.fn(),
    status: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res
}

function createController(overrides: Record<string, any> = {}) {
  const deps = {
    notificationManager: createMockNotificationManager(),
    userManager: createMockUserManager(),
    oauth: createMockOauth(),
    logger: createMockLogger(),
    ...overrides,
  }

  const controller = new NotificationsController(
    deps.notificationManager as any,
    deps.userManager as any,
    deps.oauth as any,
    deps.logger as any,
  )

  return { controller, ...deps }
}

// --- Tests ---

describe('NotificationsController', () => {
  describe('router registration', () => {
    it('should register mute/unmute/muted routes', () => {
      const { controller } = createController()
      const routes = controller.router.stack.filter((layer) => layer.route).map((layer) => layer.route.path)

      expect(routes).toEqual(
        expect.arrayContaining(['/notifications/mute', '/notifications/unmute', '/notifications/muted']),
      )
    })
  })

  describe('mute', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { userId: 20 })
      const res = createMockResponse()

      await controller.mute(req, res)

      expect(res.authRequired).toHaveBeenCalled()
      expect(res.success).not.toHaveBeenCalled()
    })

    it('should reject muting yourself', async () => {
      const { controller, notificationManager } = createController()
      const req = createMockRequest(10, { userId: 10 })
      const res = createMockResponse()

      await controller.mute(req, res)

      expect(res.error).toHaveBeenCalledWith('mute-self', expect.any(String), 400)
      expect(notificationManager.muteUser).not.toHaveBeenCalled()
    })

    it('should 404 when the target user does not exist', async () => {
      const userManager = createMockUserManager()
      userManager.getById.mockResolvedValue(undefined)

      const { controller, notificationManager } = createController({ userManager })
      const req = createMockRequest(10, { userId: 999 })
      const res = createMockResponse()

      await controller.mute(req, res)

      expect(res.error).toHaveBeenCalledWith('user-not-found', expect.any(String), 404)
      expect(notificationManager.muteUser).not.toHaveBeenCalled()
    })

    it('should mute a valid user', async () => {
      const { controller, notificationManager } = createController()
      const req = createMockRequest(10, { userId: 20 })
      const res = createMockResponse()

      await controller.mute(req, res)

      expect(notificationManager.muteUser).toHaveBeenCalledWith(10, 20)
      expect(res.success).toHaveBeenCalledWith({ muted: true })
    })

    it('should handle errors and return 500', async () => {
      const notificationManager = createMockNotificationManager()
      notificationManager.muteUser.mockRejectedValue(new Error('DB down'))

      const { controller, logger } = createController({ notificationManager })
      const req = createMockRequest(10, { userId: 20 })
      const res = createMockResponse()

      await controller.mute(req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('unmute', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { userId: 20 })
      const res = createMockResponse()

      await controller.unmute(req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should unmute a user', async () => {
      const { controller, notificationManager } = createController()
      const req = createMockRequest(10, { userId: 20 })
      const res = createMockResponse()

      await controller.unmute(req, res)

      expect(notificationManager.unmuteUser).toHaveBeenCalledWith(10, 20)
      expect(res.success).toHaveBeenCalledWith({ muted: false })
    })

    it('should handle errors and return 500', async () => {
      const notificationManager = createMockNotificationManager()
      notificationManager.unmuteUser.mockRejectedValue(new Error('DB down'))

      const { controller, logger } = createController({ notificationManager })
      const req = createMockRequest(10, { userId: 20 })
      const res = createMockResponse()

      await controller.unmute(req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('muted', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0)
      const res = createMockResponse()

      await controller.muted(req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should return the muted users list', async () => {
      const { controller, notificationManager } = createController()
      const req = createMockRequest(10)
      const res = createMockResponse()

      await controller.muted(req, res)

      expect(notificationManager.getMutedUsers).toHaveBeenCalledWith(10)
      expect(res.success).toHaveBeenCalledWith({ users: [{ id: 20, username: 'spammer', gender: 1 }] })
    })
  })
})
