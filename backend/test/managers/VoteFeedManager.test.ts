import VoteFeedManager, {
  decodeVoteFeedCursor,
  encodeVoteFeedCursor,
  InvalidVoteFeedCursorError,
} from '../../src/managers/VoteFeedManager'

describe('vote feed cursor codec', () => {
  test('round-trips a reference position', () => {
    const ref = {
      type: 'comment' as const,
      entityId: 555,
      postId: 10,
      voterId: 42,
      targetUserId: 7,
      vote: 1,
      votedAt: new Date('2026-05-01T12:00:00.000Z'),
    }

    expect(decodeVoteFeedCursor(encodeVoteFeedCursor(ref))).toEqual({
      votedAt: ref.votedAt,
      type: 'comment',
      entityId: 555,
      voterId: 42,
    })
  })

  test.each([
    ['garbage', 'not-a-cursor!!!'],
    ['valid base64 of non-json', Buffer.from('hello').toString('base64url')],
    ['missing fields', Buffer.from(JSON.stringify({ votedAt: 1 })).toString('base64url')],
    [
      'bad type',
      Buffer.from(JSON.stringify({ votedAt: 1, type: 'site', entityId: 1, voterId: 1 })).toString('base64url'),
    ],
    [
      'non-integer entity',
      Buffer.from(JSON.stringify({ votedAt: 1, type: 'post', entityId: 'x', voterId: 1 })).toString('base64url'),
    ],
  ])('rejects invalid cursor: %s', (_name, cursor) => {
    expect(() => decodeVoteFeedCursor(cursor)).toThrow(InvalidVoteFeedCursorError)
  })
})

describe('VoteFeedManager.getVoteFeed', () => {
  const users = {
    30: { id: 30, username: 'target', gender: 0, karma: 7 },
    201: { id: 201, username: 'post-author', gender: 0, karma: 0 },
    301: { id: 301, username: 'voter', gender: 0, karma: 0 },
  }

  const makeRef = (overrides: any = {}) => ({
    type: 'post',
    entityId: 10,
    postId: 10,
    voterId: 301,
    targetUserId: 201,
    vote: 1,
    votedAt: new Date('2026-05-11T10:00:00.000Z'),
    ...overrides,
  })

  const createManager = (overrides: any = {}) => {
    const voteRepository = {
      getVoteFeedEvents: jest.fn().mockResolvedValue([makeRef()]),
      ...overrides.voteRepository,
    }
    const postManager = {
      getPostsByIds: jest.fn().mockResolvedValue([{ id: 10, author: 201, title: 'Post' }]),
      getCommentsByIds: jest.fn().mockResolvedValue([]),
      getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([]),
      getPostTitlesByIds: jest.fn().mockResolvedValue({}),
      ...overrides.postManager,
    }
    const userManager = {
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
    const enricher = {
      enrichRawPosts: jest.fn((rawPosts) =>
        Promise.resolve({
          posts: rawPosts.map((post: any) => ({ ...post, vote: 0 })),
          users: { 201: users[201] },
        }),
      ),
      enrichRawComments: jest.fn((comments, currentUsers) =>
        Promise.resolve({
          allComments: comments.map((comment: any) => ({ ...comment, source: 'Comment' })),
          users: currentUsers,
        }),
      ),
      ...overrides.enricher,
    }
    const logger = { warn: jest.fn(), error: jest.fn() }
    const manager = new VoteFeedManager(
      voteRepository as any,
      postManager as any,
      userManager as any,
      enricher as any,
      logger as any,
    )
    return { manager, voteRepository, postManager, userManager, enricher, logger }
  }

  test('fetches perpage + 1 references and reports hasMore with a cursor of the last returned event', async () => {
    const refs = [
      makeRef({ entityId: 11, postId: 11, votedAt: new Date('2026-05-11T12:00:00.000Z') }),
      makeRef({ entityId: 10, postId: 10, votedAt: new Date('2026-05-11T11:00:00.000Z') }),
      makeRef({ entityId: 9, postId: 9, votedAt: new Date('2026-05-11T10:00:00.000Z') }),
    ]
    const { manager, voteRepository, postManager } = createManager({
      voteRepository: { getVoteFeedEvents: jest.fn().mockResolvedValue(refs) },
      postManager: {
        getPostsByIds: jest.fn().mockResolvedValue([
          { id: 11, author: 201 },
          { id: 10, author: 201 },
        ]),
      },
    })

    const result = await manager.getVoteFeed(123, 'mine', '', undefined, 2, 'html')

    expect(voteRepository.getVoteFeedEvents).toHaveBeenCalledWith(123, 'mine', '', undefined, 3)
    // the extra row is only a hasMore probe and must not be fetched or returned
    expect(postManager.getPostsByIds).toHaveBeenCalledWith([11, 10], 123, 'html')
    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(decodeVoteFeedCursor(result.nextCursor!)).toEqual({
      votedAt: new Date('2026-05-11T11:00:00.000Z'),
      type: 'post',
      entityId: 10,
      voterId: 301,
    })
  })

  test('decodes the incoming cursor and passes it to the repository', async () => {
    const { manager, voteRepository } = createManager()
    const cursor = encodeVoteFeedCursor(makeRef({ entityId: 99 }))

    await manager.getVoteFeed(123, 'received', 'abc', cursor, 20, 'html')

    expect(voteRepository.getVoteFeedEvents).toHaveBeenCalledWith(
      123,
      'received',
      'abc',
      { votedAt: new Date('2026-05-11T10:00:00.000Z'), type: 'post', entityId: 99, voterId: 301 },
      21,
    )
  })

  test('throws InvalidVoteFeedCursorError before touching the repository', async () => {
    const { manager, voteRepository } = createManager()

    await expect(manager.getVoteFeed(123, 'mine', '', 'broken!', 20, 'html')).rejects.toBeInstanceOf(
      InvalidVoteFeedCursorError,
    )
    expect(voteRepository.getVoteFeedEvents).not.toHaveBeenCalled()
  })

  test('builds flat events without overriding the entity vote', async () => {
    const { manager } = createManager()

    const result = await manager.getVoteFeed(123, 'received', '', undefined, 20, 'html')

    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeUndefined()
    expect(result.events).toEqual([
      {
        type: 'post',
        vote: 1,
        votedAt: '2026-05-11T10:00:00.000Z',
        voterId: 301,
        targetUserId: 201,
        // the entity keeps the session user's own vote; event.vote carries the feed vote
        post: { id: 10, author: 201, title: 'Post', vote: 0 },
      },
    ])
    expect(result.users).toMatchObject({ 201: users[201], 301: users[301] })
  })

  test('comment events carry the parent post title fetched in batch', async () => {
    const { manager, postManager } = createManager({
      voteRepository: {
        getVoteFeedEvents: jest
          .fn()
          .mockResolvedValue([makeRef({ type: 'comment', entityId: 555, postId: 77, targetUserId: 201 })]),
      },
      postManager: {
        getPostsByIds: jest.fn().mockResolvedValue([]),
        getCommentsByIds: jest.fn().mockResolvedValue([{ id: 555, author: 201, parentComment: undefined }]),
        getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([]),
        getPostTitlesByIds: jest.fn().mockResolvedValue({ 77: 'Parent post' }),
      },
    })

    const result = await manager.getVoteFeed(123, 'received', '', undefined, 20, 'html')

    expect(postManager.getPostTitlesByIds).toHaveBeenCalledWith([77])
    expect(result.events[0]).toMatchObject({ type: 'comment', postTitle: 'Parent post' })
  })

  test('builds user events from the shared users map', async () => {
    const { manager } = createManager({
      voteRepository: {
        getVoteFeedEvents: jest
          .fn()
          .mockResolvedValue([makeRef({ type: 'user', entityId: 30, postId: undefined, targetUserId: 30, vote: 2 })]),
      },
      postManager: {
        getPostsByIds: jest.fn().mockResolvedValue([]),
        getCommentsByIds: jest.fn().mockResolvedValue([]),
        getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([]),
      },
    })

    const result = await manager.getVoteFeed(123, 'mine', '', undefined, 20, 'html')

    expect(result.events).toEqual([
      {
        type: 'user',
        vote: 2,
        votedAt: '2026-05-11T10:00:00.000Z',
        voterId: 301,
        targetUserId: 30,
        user: users[30],
      },
    ])
  })

  test('drops events with missing entities and logs a warning', async () => {
    const { manager, logger } = createManager({
      postManager: {
        getPostsByIds: jest.fn().mockResolvedValue([]),
        getCommentsByIds: jest.fn().mockResolvedValue([]),
        getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([]),
      },
    })

    const result = await manager.getVoteFeed(123, 'mine', '', undefined, 20, 'html')

    expect(result.events).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      'Dropped vote feed event with missing entity',
      expect.objectContaining({ type: 'post', entityId: 10 }),
    )
  })
})
