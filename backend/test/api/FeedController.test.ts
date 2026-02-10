import FeedController from '../../src/api/FeedController'
import { FeedSorting } from '../../src/api/types/entities/common'

// --- Mock factories ---

function createMockEnricher() {
  return {
    enrichRawPosts: jest.fn().mockResolvedValue({
      posts: [{ id: 1, title: 'Test Post' }],
      users: { 10: { id: 10, username: 'testuser' } },
      sites: { main: { site: 'main', name: 'Main' } },
    }),
    siteInfoToEntity: jest.fn().mockReturnValue({
      site: 'test',
      name: 'Test Site',
    }),
  }
}

function createMockFeedManager() {
  return {
    getRestrictedPosts: jest.fn().mockResolvedValue(null),
    getSubscriptionFeed: jest.fn().mockResolvedValue({
      total: 1,
      posts: [{ id: 1, author: 10, site: 'main' }],
    }),
    getAllPosts: jest.fn().mockResolvedValue([{ id: 2, author: 10, site: 'main' }]),
    getAllPostsTotal: jest.fn().mockResolvedValue(42),
    getSiteFeed: jest.fn().mockResolvedValue([{ id: 3, author: 10, site: 'test' }]),
    getSiteTotal: jest.fn().mockResolvedValue(15),
    getWatchFeed: jest.fn().mockResolvedValue([{ id: 4, author: 10, site: 'main' }]),
    getWatchTotal: jest.fn().mockResolvedValue(5),
  }
}

function createMockSiteManager() {
  return {
    getSiteByNameWithUserInfo: jest.fn().mockResolvedValue({
      id: 1,
      site: 'test',
      name: 'Test Site',
    }),
  }
}

function createMockUserManager() {
  return {
    logVisit: jest.fn(),
    getFeedSorting: jest.fn().mockResolvedValue(FeedSorting.postCommentedAt),
    saveFeedSorting: jest.fn().mockResolvedValue(undefined),
  }
}

function createMockPostManager() {
  return {
    getPostsByUserTotal: jest.fn().mockResolvedValue(3),
  }
}

function createMockOauth() {
  // OAuth middleware generator — returns a no-op middleware
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
  }
  return res
}

function createController(overrides: Record<string, any> = {}) {
  const deps = {
    enricher: createMockEnricher(),
    feedManager: createMockFeedManager(),
    siteManager: createMockSiteManager(),
    userManager: createMockUserManager(),
    postManager: createMockPostManager(),
    oauth: createMockOauth(),
    logger: createMockLogger(),
    ...overrides,
  }

  const controller = new FeedController(
    deps.enricher as any,
    deps.feedManager as any,
    deps.siteManager as any,
    deps.userManager as any,
    deps.postManager as any,
    deps.oauth as any,
    deps.logger as any,
  )

  return { controller, ...deps }
}

// --- Tests ---

describe('FeedController', () => {
  describe('router registration', () => {
    it('should register all feed routes', () => {
      const { controller } = createController()
      const routes = controller.router.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }))

      expect(routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: '/feed/subscriptions', methods: ['post'] }),
          expect.objectContaining({ path: '/feed/all', methods: ['post'] }),
          expect.objectContaining({ path: '/feed/posts', methods: ['post'] }),
          expect.objectContaining({ path: '/feed/watch', methods: ['post'] }),
          expect.objectContaining({ path: '/feed/sorting', methods: ['post'] }),
        ]),
      )
    })
  })

  describe('feedSubscriptions', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedSubscriptions'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
      expect(res.success).not.toHaveBeenCalled()
    })

    it('should return subscription feed for authenticated user', async () => {
      const { controller, feedManager, userManager, enricher } = createController()
      const req = createMockRequest(123, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedSubscriptions'](req, res)

      expect(userManager.logVisit).toHaveBeenCalledWith(123)
      expect(userManager.getFeedSorting).toHaveBeenCalledWith(123, 1)
      expect(feedManager.getRestrictedPosts).toHaveBeenCalledWith(
        123,
        1,
        10,
        'html',
        FeedSorting.postCommentedAt,
      )
      expect(feedManager.getSubscriptionFeed).toHaveBeenCalledWith(
        123,
        1,
        10,
        'html',
        FeedSorting.postCommentedAt,
      )
      expect(enricher.enrichRawPosts).toHaveBeenCalled()
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: expect.any(Array),
          total: expect.any(Number),
          users: expect.any(Object),
          sites: expect.any(Object),
          sorting: FeedSorting.postCommentedAt,
        }),
      )
    })

    it('should use restricted posts when user has restrictions', async () => {
      const restrictedPosts = [{ id: 99, author: 123, site: 'main' }]
      const feedManager = createMockFeedManager()
      feedManager.getRestrictedPosts.mockResolvedValue(restrictedPosts)

      const { controller, postManager, enricher } = createController({ feedManager })
      const req = createMockRequest(123, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedSubscriptions'](req, res)

      // Should get total from postManager, not feedManager
      expect(postManager.getPostsByUserTotal).toHaveBeenCalledWith(123)
      // Should NOT call getSubscriptionFeed
      expect(feedManager.getSubscriptionFeed).not.toHaveBeenCalled()
      // Should enrich the restricted posts
      expect(enricher.enrichRawPosts).toHaveBeenCalledWith(restrictedPosts)
    })

    it('should handle errors and return 500', async () => {
      const feedManager = createMockFeedManager()
      feedManager.getRestrictedPosts.mockRejectedValue(new Error('DB connection failed'))

      const { controller, logger } = createController({ feedManager })
      const req = createMockRequest(123, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedSubscriptions'](req, res)

      expect(logger.error).toHaveBeenCalledWith(
        'Subscriptions feed failed',
        expect.objectContaining({ error: expect.any(Error), user_id: 123 }),
      )
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('feedAll', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedAll'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should return all posts feed', async () => {
      const { controller, feedManager, enricher } = createController()
      const req = createMockRequest(456, { page: 2, perpage: 20, format: 'html' })
      const res = createMockResponse()

      await controller['feedAll'](req, res)

      expect(feedManager.getAllPostsTotal).toHaveBeenCalled()
      expect(feedManager.getAllPosts).toHaveBeenCalledWith(
        456,
        2,
        20,
        'html',
        FeedSorting.postCommentedAt,
      )
      expect(enricher.enrichRawPosts).toHaveBeenCalled()
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: expect.any(Array),
          total: 42,
          sorting: FeedSorting.postCommentedAt,
        }),
      )
    })

    it('should use restricted posts when user has restrictions', async () => {
      const restrictedPosts = [{ id: 99, author: 456, site: 'main' }]
      const feedManager = createMockFeedManager()
      feedManager.getRestrictedPosts.mockResolvedValue(restrictedPosts)

      const { controller, postManager } = createController({ feedManager })
      const req = createMockRequest(456, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedAll'](req, res)

      expect(postManager.getPostsByUserTotal).toHaveBeenCalledWith(456)
      expect(feedManager.getAllPosts).not.toHaveBeenCalled()
      expect(feedManager.getAllPostsTotal).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const userManager = createMockUserManager()
      userManager.getFeedSorting.mockRejectedValue(new Error('timeout'))

      const { controller, logger } = createController({ userManager })
      const req = createMockRequest(456, { page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedAll'](req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('feedPosts', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { site: 'test', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedPosts'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should return site-specific feed', async () => {
      const { controller, siteManager, feedManager, enricher } = createController()
      const req = createMockRequest(789, { site: 'test', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedPosts'](req, res)

      expect(siteManager.getSiteByNameWithUserInfo).toHaveBeenCalledWith(789, 'test')
      expect(feedManager.getSiteFeed).toHaveBeenCalled()
      expect(enricher.siteInfoToEntity).toHaveBeenCalled()
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: expect.any(Array),
          total: 15,
          site: expect.any(Object),
          sorting: FeedSorting.postCommentedAt,
        }),
      )
    })

    it('should use restricted posts when user has restrictions', async () => {
      const restrictedPosts = [{ id: 99, author: 789, site: 'test' }]
      const feedManager = createMockFeedManager()
      feedManager.getRestrictedPosts.mockResolvedValue(restrictedPosts)

      const { controller, postManager } = createController({ feedManager })
      const req = createMockRequest(789, { site: 'test', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedPosts'](req, res)

      expect(postManager.getPostsByUserTotal).toHaveBeenCalledWith(789)
      expect(feedManager.getSiteFeed).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const siteManager = createMockSiteManager()
      siteManager.getSiteByNameWithUserInfo.mockRejectedValue(new Error('not found'))

      const { controller, logger } = createController({ siteManager })
      const req = createMockRequest(789, { site: 'bad', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedPosts'](req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('feedWatch', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { filter: 'new', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedWatch'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should return watched posts with "new" filter', async () => {
      const { controller, feedManager } = createController()
      const req = createMockRequest(321, { filter: 'new', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedWatch'](req, res)

      expect(feedManager.getWatchTotal).toHaveBeenCalledWith(321, false)
      expect(feedManager.getWatchFeed).toHaveBeenCalledWith(321, 1, 10, false, 'html')
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: expect.any(Array),
          total: 5,
        }),
      )
    })

    it('should return all watched posts with "all" filter', async () => {
      const { controller, feedManager } = createController()
      const req = createMockRequest(321, { filter: 'all', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedWatch'](req, res)

      expect(feedManager.getWatchTotal).toHaveBeenCalledWith(321, true)
      expect(feedManager.getWatchFeed).toHaveBeenCalledWith(321, 1, 10, true, 'html')
    })

    it('should always use postCommentedAt sorting for watch feed', async () => {
      const { controller, feedManager } = createController()
      const req = createMockRequest(321, { filter: 'new', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedWatch'](req, res)

      // feedWatch hardcodes FeedSorting.postCommentedAt for getRestrictedPosts
      expect(feedManager.getRestrictedPosts).toHaveBeenCalledWith(
        321,
        1,
        10,
        'html',
        FeedSorting.postCommentedAt,
      )
    })

    it('should handle errors', async () => {
      const feedManager = createMockFeedManager()
      feedManager.getWatchFeed.mockRejectedValue(new Error('watch error'))

      const { controller, logger } = createController({ feedManager })
      const req = createMockRequest(321, { filter: 'new', page: 1, perpage: 10, format: 'html' })
      const res = createMockResponse()

      await controller['feedWatch'](req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })

  describe('saveFeedSorting', () => {
    it('should require authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(0, { site: 'main', feedSorting: FeedSorting.postCreatedAt })
      const res = createMockResponse()

      await controller['saveFeedSorting'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
    })

    it('should save feed sorting preference', async () => {
      const { controller, userManager } = createController()
      const req = createMockRequest(555, { site: 'main', feedSorting: FeedSorting.postCreatedAt })
      const res = createMockResponse()

      await controller['saveFeedSorting'](req, res)

      expect(userManager.saveFeedSorting).toHaveBeenCalledWith(
        'main',
        FeedSorting.postCreatedAt,
        555,
      )
      expect(res.success).toHaveBeenCalledWith({})
    })

    it('should save postCommentedAt sorting', async () => {
      const { controller, userManager } = createController()
      const req = createMockRequest(555, {
        site: 'tech',
        feedSorting: FeedSorting.postCommentedAt,
      })
      const res = createMockResponse()

      await controller['saveFeedSorting'](req, res)

      expect(userManager.saveFeedSorting).toHaveBeenCalledWith(
        'tech',
        FeedSorting.postCommentedAt,
        555,
      )
      expect(res.success).toHaveBeenCalledWith({})
    })

    it('should handle errors', async () => {
      const userManager = createMockUserManager()
      userManager.saveFeedSorting.mockRejectedValue(new Error('save failed'))

      const { controller, logger } = createController({ userManager })
      const req = createMockRequest(555, { site: 'main', feedSorting: FeedSorting.postCreatedAt })
      const res = createMockResponse()

      await controller['saveFeedSorting'](req, res)

      expect(logger.error).toHaveBeenCalled()
      expect(res.error).toHaveBeenCalledWith('unknown', 'Unknown error', 500)
    })
  })
})
