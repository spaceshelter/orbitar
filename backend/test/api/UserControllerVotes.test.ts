import UserController from '../../src/api/UserController'

describe('UserController votes', () => {
  const users = {
    30: { id: 30, username: 'target', name: 'Target', gender: 0, karma: 7 },
    201: { id: 201, username: 'post-author', gender: 0, karma: 0 },
    301: { id: 301, username: 'voter', gender: 0, karma: 0 },
  }

  const createController = (overrides: any = {}) => {
    const enricher = {
      enrichRawPosts: jest.fn().mockResolvedValue({
        posts: [{ id: 10, author: 201, title: 'Post' }],
        users: { 201: users[201] },
      }),
      enrichRawComments: jest.fn((comments, currentUsers) =>
        Promise.resolve({
          allComments: comments.map((comment: any) => ({ ...comment, source: 'Comment' })),
          users: currentUsers,
        }),
      ),
      ...overrides.enricher,
    }
    const userManager = {
      getById: jest.fn((id: number) => Promise.resolve(users[id])),
      getByIds: jest.fn((ids: number[]) => {
        const result: Record<number, any> = {}
        for (const id of ids) {
          if (users[id]) {
            result[id] = users[id]
          }
        }
        return Promise.resolve(result)
      }),
      ...overrides.userManager,
    }
    const postManager = {
      getPostsByIds: jest.fn().mockResolvedValue([{ id: 10, author: 201 }]),
      getCommentsByIds: jest.fn().mockResolvedValue([]),
      getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([]),
      ...overrides.postManager,
    }
    const voteManager = {
      getVoteFeedTotal: jest.fn().mockResolvedValue(1),
      getVoteFeedEvents: jest.fn().mockResolvedValue([
        {
          type: 'post',
          entityId: 10,
          postId: 10,
          voterId: 301,
          targetUserId: 201,
          vote: 1,
          votedAt: new Date('2026-05-11T10:00:00.000Z'),
        },
      ]),
      ...overrides.voteManager,
    }
    const logger = {
      error: jest.fn(),
    }
    const controller = new UserController(
      enricher as any,
      userManager as any,
      postManager as any,
      voteManager as any,
      {} as any,
      jest.fn(() => (_request: any, _response: any, next: any) => next()) as any,
      {} as any,
      logger as any,
    )

    return { controller, voteManager, userManager, postManager }
  }

  test('requires authorization', async () => {
    const { controller } = createController()
    const response = { authRequired: jest.fn() }

    await controller['votes']({ session: { data: {} }, body: {} } as any, response as any)

    expect(response.authRequired).toHaveBeenCalledTimes(1)
  })

  test('uses session user id and ignores body identity fields', async () => {
    const { controller, voteManager, userManager, postManager } = createController()
    const response = { success: jest.fn(), error: jest.fn() }

    await controller['votes'](
      {
        session: { data: { userId: 123 } },
        body: {
          direction: 'received',
          format: 'html',
          filter: 'orbitar',
          page: 2,
          perpage: 20,
          userId: 999,
          username: 'someone-else',
        },
      } as any,
      response as any,
    )

    expect(voteManager.getVoteFeedTotal).toHaveBeenCalledWith(123, 'received', 'orbitar')
    expect(voteManager.getVoteFeedEvents).toHaveBeenCalledWith(123, 'received', 'orbitar', 2, 20)
    expect(postManager.getPostsByIds).toHaveBeenCalledWith([10], 123, 'html')
    expect(postManager.getCommentsByIds).toHaveBeenCalledWith([], 123, 'html')
    expect(userManager.getByIds).toHaveBeenCalledWith([301])
    expect(userManager.getById).not.toHaveBeenCalled()
    expect(response.success).toHaveBeenCalledWith({
      total: 1,
      groups: [
        {
          kind: 'single',
          latestAt: '2026-05-11T10:00:00.000Z',
          entityType: undefined,
          entityId: undefined,
          voterId: undefined,
          targetUserId: undefined,
          contextPostId: undefined,
          events: [
            {
              type: 'post',
              vote: 1,
              votedAt: '2026-05-11T10:00:00.000Z',
              voterId: 301,
              targetUserId: 201,
              post: { id: 10, author: 201, title: 'Post', vote: 1 },
            },
          ],
        },
      ],
      users: {
        201: users[201],
        301: users[301],
      },
    })
  })
})
