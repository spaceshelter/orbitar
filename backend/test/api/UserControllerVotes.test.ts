import UserController from '../../src/api/UserController'
import { VoteFeedFilterTimeoutError } from '../../src/db/repositories/VoteFeedReadRepository'
import { InvalidVoteFeedCursorError } from '../../src/managers/VoteFeedManager'

describe('UserController votes', () => {
  const createController = (overrides: any = {}) => {
    const voteFeedManager = {
      getVoteFeed: jest.fn().mockResolvedValue({
        events: [],
        users: {},
        hasMore: false,
        nextCursor: undefined,
      }),
      ...overrides.voteFeedManager,
    }
    const userManager = {
      getUserRestrictionsSnapshot: jest.fn().mockResolvedValue({ restrictedToPostId: false }),
      getUserRestrictions: jest.fn(),
      ...overrides.userManager,
    }
    const logger = {
      error: jest.fn(),
    }
    const controller = new UserController(
      {} as any,
      userManager as any,
      {} as any,
      voteFeedManager as any,
      {} as any,
      jest.fn(() => (_request: any, _response: any, next: any) => next()) as any,
      {} as any,
      logger as any,
    )

    return { controller, voteFeedManager, userManager, logger }
  }

  test('requires authorization', async () => {
    const { controller, voteFeedManager } = createController()
    const response = { authRequired: jest.fn() }

    await controller['votes']({ session: { data: {} }, body: {} } as any, response as any)

    expect(response.authRequired).toHaveBeenCalledTimes(1)
    expect(voteFeedManager.getVoteFeed).not.toHaveBeenCalled()
  })

  // In production Joi's validate() rejects unknown body keys with 400 before this
  // handler runs (covered by the route-validation tests below); this asserts the
  // handler itself derives the feed owner from the session and never from the body.
  test('derives the feed owner from the session even if the body smuggles identity fields', async () => {
    const payload = {
      events: [{ type: 'post' }],
      users: { 1: { id: 1 } },
      hasMore: true,
      nextCursor: 'abc',
    }
    const { controller, voteFeedManager } = createController({
      voteFeedManager: { getVoteFeed: jest.fn().mockResolvedValue(payload) },
    })
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: {
          direction: 'received',
          filter: 'orbitar',
          cursor: 'cursor-token',
          perpage: 20,
          userId: 999,
          username: 'someone-else',
        },
      } as any,
      response as any,
    )

    expect(voteFeedManager.getVoteFeed).toHaveBeenCalledWith(123, 'received', 'orbitar', 'cursor-token', 20)
    expect(response.success).toHaveBeenCalledWith(payload)
    expect(response.error).not.toHaveBeenCalled()
  })

  test('defaults perpage to 20 and omits empty cursor and filter', async () => {
    const { controller, voteFeedManager } = createController()
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: { direction: 'mine', filter: '', cursor: '' },
      } as any,
      response as any,
    )

    expect(voteFeedManager.getVoteFeed).toHaveBeenCalledWith(123, 'mine', '', undefined, 20)
  })

  test('rejects restricted users before loading the vote feed', async () => {
    const { controller, voteFeedManager, userManager } = createController({
      userManager: { getUserRestrictionsSnapshot: jest.fn().mockResolvedValue({ restrictedToPostId: 42 }) },
    })
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: { direction: 'mine' },
      } as any,
      response as any,
    )

    expect(userManager.getUserRestrictionsSnapshot).toHaveBeenCalledWith(123)
    expect(userManager.getUserRestrictions).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalledWith('no-permission', 'You are not allowed to view your votes feed', 403)
    expect(voteFeedManager.getVoteFeed).not.toHaveBeenCalled()
    expect(response.success).not.toHaveBeenCalled()
  })

  test('route validation rejects a fractional perpage', async () => {
    const { controller } = createController()
    const votesRoute = controller.router.stack.find((layer) => layer.route?.path === '/user/votes')
    const validateVotes = votesRoute?.route.stack[2].handle
    const response = { error: jest.fn() }
    const next = jest.fn()

    expect(validateVotes).toBeDefined()
    await new Promise<void>((resolve) => {
      response.error.mockImplementation(() => resolve())
      validateVotes({ body: { direction: 'mine', perpage: 1.5 } } as any, response as any, () => {
        next()
        resolve()
      })
    })

    expect(response.error).toHaveBeenCalledWith(
      'invalid-payload',
      expect.stringContaining('integer'),
      400,
      expect.any(Object),
    )
    expect(next).not.toHaveBeenCalled()
  })

  test('route validation rejects unknown identity fields in the body', async () => {
    const { controller } = createController()
    const votesRoute = controller.router.stack.find((layer) => layer.route?.path === '/user/votes')
    const validateVotes = votesRoute?.route.stack[2].handle
    const response = { error: jest.fn() }
    const next = jest.fn()

    expect(validateVotes).toBeDefined()
    await new Promise<void>((resolve) => {
      response.error.mockImplementation(() => resolve())
      validateVotes(
        { body: { direction: 'mine', userId: 999, username: 'someone-else' } } as any,
        response as any,
        () => {
          next()
          resolve()
        },
      )
    })

    expect(response.error).toHaveBeenCalledWith(
      'invalid-payload',
      expect.stringContaining('not allowed'),
      400,
      expect.any(Object),
    )
    expect(next).not.toHaveBeenCalled()
  })

  test('responds 400 on an invalid cursor', async () => {
    const { controller, logger } = createController({
      voteFeedManager: { getVoteFeed: jest.fn().mockRejectedValue(new InvalidVoteFeedCursorError()) },
    })
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: { direction: 'mine', cursor: 'broken' },
      } as any,
      response as any,
    )

    expect(response.error).toHaveBeenCalledWith('invalid-payload', 'Invalid cursor', 400)
    expect(logger.error).not.toHaveBeenCalled()
  })

  test('responds 400 when the filtered feed query times out', async () => {
    const { controller, logger } = createController({
      voteFeedManager: { getVoteFeed: jest.fn().mockRejectedValue(new VoteFeedFilterTimeoutError()) },
    })
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: { direction: 'mine', filter: 'needle' },
      } as any,
      response as any,
    )

    expect(response.error).toHaveBeenCalledWith('filter-timeout', 'Filter is too heavy, narrow the query', 400)
    expect(logger.error).not.toHaveBeenCalled()
  })

  test('responds 500 on unexpected errors', async () => {
    const { controller, logger } = createController({
      voteFeedManager: { getVoteFeed: jest.fn().mockRejectedValue(new Error('db down')) },
    })
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: { direction: 'mine' },
      } as any,
      response as any,
    )

    expect(response.error).toHaveBeenCalledWith('error', 'Could not get user votes feed', 500)
    expect(logger.error).toHaveBeenCalled()
  })
})
