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
    [
      'out-of-range timestamp',
      Buffer.from(JSON.stringify({ votedAt: Number.MAX_VALUE, type: 'post', entityId: 1, voterId: 1 })).toString(
        'base64url',
      ),
    ],
  ])('rejects invalid cursor: %s', (_name, cursor) => {
    expect(() => decodeVoteFeedCursor(cursor)).toThrow(InvalidVoteFeedCursorError)
  })
})

describe('VoteFeedManager.getVoteFeed', () => {
  const users = {
    30: {
      id: 30,
      username: 'target',
      gender: 0,
      karma: 7,
      name: 'Target',
      registered: new Date('2020-01-01'),
      ontrial: false,
      bio_source: 'private source',
      bio_html: '<p>private html</p>',
    },
    201: {
      id: 201,
      username: 'post-author',
      gender: 0,
      karma: 0,
      name: 'Author',
      registered: new Date('2020-01-01'),
      ontrial: false,
    },
    301: {
      id: 301,
      username: 'voter',
      gender: 0,
      karma: 0,
      name: 'Voter',
      registered: new Date('2020-01-01'),
      ontrial: false,
    },
    302: {
      id: 302,
      username: 'another-voter',
      gender: 0,
      karma: 0,
      name: 'Another voter',
      registered: new Date('2020-01-01'),
      ontrial: false,
    },
  }

  const makeRef = (overrides: any = {}) => ({
    type: 'post' as const,
    entityId: 10,
    postId: 10,
    voterId: 301,
    targetUserId: 201,
    vote: 1,
    votedAt: new Date('2026-05-11T10:00:00.000Z'),
    ...overrides,
  })

  const createManager = (overrides: any = {}) => {
    const voteFeedReadRepository = {
      getPageReferences: jest.fn().mockResolvedValue([makeRef()]),
      getReceivedPostSubjects: jest.fn().mockResolvedValue([]),
      getReceivedCommentSubjects: jest.fn().mockResolvedValue([]),
      ...overrides.voteFeedReadRepository,
    }
    const postManager = {
      getPostsByIds: jest.fn().mockResolvedValue([
        {
          id: 10,
          site: 'main',
          author: 201,
          created: new Date('2026-05-01T10:00:00.000Z'),
          title: 'Post',
          content: '<p>content</p>',
          rating: 3,
          comments: 1,
          newComments: 0,
          vote: 0,
        },
      ]),
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
    const logger = { warn: jest.fn(), error: jest.fn() }
    const manager = new VoteFeedManager(
      voteFeedReadRepository as any,
      postManager as any,
      userManager as any,
      logger as any,
    )
    return { manager, voteFeedReadRepository, postManager, userManager, logger }
  }

  test('fetches perpage + 1 references and cursors from the last returned reference', async () => {
    const refs = [
      makeRef({ entityId: 11, postId: 11, votedAt: new Date('2026-05-11T12:00:00.000Z') }),
      makeRef({ entityId: 10, postId: 10, votedAt: new Date('2026-05-11T11:00:00.000Z') }),
      makeRef({ entityId: 9, postId: 9, votedAt: new Date('2026-05-11T10:00:00.000Z') }),
    ]
    const { manager, voteFeedReadRepository, postManager } = createManager({
      voteFeedReadRepository: { getPageReferences: jest.fn().mockResolvedValue(refs) },
      postManager: {
        getPostsByIds: jest.fn().mockResolvedValue([
          {
            id: 11,
            site: 'main',
            author: 201,
            created: new Date(),
            rating: 0,
            comments: 0,
            newComments: 0,
          },
          {
            id: 10,
            site: 'main',
            author: 201,
            created: new Date(),
            rating: 0,
            comments: 0,
            newComments: 0,
          },
        ]),
      },
    })

    const result = await manager.getVoteFeed(123, 'mine', '', undefined, 2)

    expect(voteFeedReadRepository.getPageReferences).toHaveBeenCalledWith(123, 'mine', '', undefined, 3)
    expect(postManager.getPostsByIds).toHaveBeenCalledWith([11, 10], 123)
    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(decodeVoteFeedCursor(result.nextCursor!)).toEqual({
      votedAt: new Date('2026-05-11T11:00:00.000Z'),
      type: 'post',
      entityId: 10,
      voterId: 301,
    })
  })

  test('decodes an incoming cursor before querying references', async () => {
    const { manager, voteFeedReadRepository } = createManager({
      voteFeedReadRepository: { getPageReferences: jest.fn().mockResolvedValue([]) },
    })
    const cursor = encodeVoteFeedCursor(makeRef({ entityId: 99 }))

    await manager.getVoteFeed(123, 'received', 'abc', cursor, 20)

    expect(voteFeedReadRepository.getPageReferences).toHaveBeenCalledWith(
      123,
      'received',
      'abc',
      { votedAt: new Date('2026-05-11T10:00:00.000Z'), type: 'post', entityId: 99, voterId: 301 },
      21,
    )
  })

  test('throws InvalidVoteFeedCursorError before touching the repository', async () => {
    const { manager, voteFeedReadRepository } = createManager()

    await expect(manager.getVoteFeed(123, 'mine', '', 'broken!', 20)).rejects.toBeInstanceOf(InvalidVoteFeedCursorError)
    expect(voteFeedReadRepository.getPageReferences).not.toHaveBeenCalled()
  })

  test('normalizes mine entities and loads all users in one batch with an explicit allowlist', async () => {
    const refs = [
      makeRef(),
      makeRef({ type: 'comment', entityId: 55, postId: 77 }),
      makeRef({ type: 'user', entityId: 30, postId: undefined, targetUserId: 30, vote: 2 }),
    ]
    const { manager, userManager } = createManager({
      voteFeedReadRepository: { getPageReferences: jest.fn().mockResolvedValue(refs) },
      postManager: {
        getCommentsByIds: jest.fn().mockResolvedValue([
          {
            id: 55,
            author: 201,
            content: 'Comment',
            created: new Date('2026-05-02T10:00:00.000Z'),
            rating: 2,
            parentComment: 50,
            post: 77,
            site: 'main',
          },
        ]),
        getParentCommentsForASetOfComments: jest.fn().mockResolvedValue([
          {
            id: 50,
            author: 201,
            content: 'Parent',
            created: new Date('2026-05-01T10:00:00.000Z'),
            rating: 1,
            post: 77,
            site: 'main',
          },
        ]),
        getPostTitlesByIds: jest.fn().mockResolvedValue({ 77: 'Parent post' }),
      },
    })

    const result = await manager.getVoteFeed(123, 'mine', '', undefined, 20)

    expect(result.direction).toBe('mine')
    if (result.direction !== 'mine') {
      throw new Error('expected mine response')
    }
    expect(result.events).toEqual(
      refs.map((ref) => ({
        type: ref.type,
        entityId: ref.entityId,
        postId: ref.postId,
        voterId: ref.voterId,
        targetUserId: ref.targetUserId,
        vote: ref.vote,
        votedAt: ref.votedAt.toISOString(),
      })),
    )
    expect(result.entities.posts[10]).toMatchObject({ id: 10, title: 'Post', vote: 0 })
    expect(result.entities.comments[55]).toMatchObject({ id: 55, post: 77 })
    expect(result.entities.parentComments[50]).toMatchObject({ id: 50 })
    expect(result.entities.postTitles).toMatchObject({ 10: 'Post', 77: 'Parent post' })
    expect(userManager.getByIds).toHaveBeenCalledTimes(1)
    expect(result.users[30]).toEqual({
      id: 30,
      username: 'target',
      gender: 0,
      karma: 7,
      name: 'Target',
      vote: undefined,
    })
    expect(result.users[30]).not.toHaveProperty('registered')
    expect(result.users[30]).not.toHaveProperty('ontrial')
    expect(result.users[30]).not.toHaveProperty('bio_source')
    expect(result.users[30]).not.toHaveProperty('bio_html')
  })

  test('uses compact received subjects and never hydrates full content', async () => {
    const refs = [makeRef(), makeRef({ voterId: 302, votedAt: new Date('2026-05-11T09:00:00.000Z') })]
    const html = `<p>${'heavy '.repeat(2_000)}</p>`
    const { manager, voteFeedReadRepository, postManager, userManager } = createManager({
      voteFeedReadRepository: {
        getPageReferences: jest.fn().mockResolvedValue(refs),
        getReceivedPostSubjects: jest.fn().mockResolvedValue([{ id: 10, site: 'main', title: '', html, rating: 9 }]),
      },
    })

    const result = await manager.getVoteFeed(123, 'received', '', undefined, 20)

    expect(result.direction).toBe('received')
    if (result.direction !== 'received') {
      throw new Error('expected received response')
    }
    expect(result.events).toHaveLength(2)
    expect(Object.keys(result.subjects.posts)).toEqual(['10'])
    expect(result.subjects.posts[10]).toEqual({
      id: 10,
      site: 'main',
      label: expect.stringMatching(/^heavy/),
      rating: 9,
    })
    expect(result.subjects.posts[10].label.length).toBeLessThanOrEqual(72)
    expect(voteFeedReadRepository.getReceivedPostSubjects).toHaveBeenCalledWith([10])
    expect(postManager.getPostsByIds).not.toHaveBeenCalled()
    expect(postManager.getCommentsByIds).not.toHaveBeenCalled()
    expect(userManager.getByIds).toHaveBeenCalledTimes(1)
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(25_000)
  })

  test('hydrates compact received comments with their post title', async () => {
    const ref = makeRef({ type: 'comment', entityId: 55, postId: 77 })
    const { manager, voteFeedReadRepository } = createManager({
      voteFeedReadRepository: {
        getPageReferences: jest.fn().mockResolvedValue([ref]),
        getReceivedCommentSubjects: jest
          .fn()
          .mockResolvedValue([{ id: 55, postId: 77, site: 'main', postTitle: 'Parent post', rating: 2 }]),
      },
    })

    const result = await manager.getVoteFeed(123, 'received', '', undefined, 20)

    expect(result.direction).toBe('received')
    if (result.direction !== 'received') {
      throw new Error('expected received response')
    }
    expect(voteFeedReadRepository.getReceivedCommentSubjects).toHaveBeenCalledWith([55])
    expect(result.subjects.comments[55]).toEqual({
      id: 55,
      postId: 77,
      site: 'main',
      postTitle: 'Parent post',
      rating: 2,
    })
  })

  test('drops references whose subject disappeared and logs a warning', async () => {
    const { manager, logger } = createManager({
      voteFeedReadRepository: {
        getReceivedPostSubjects: jest.fn().mockResolvedValue([]),
      },
    })

    const result = await manager.getVoteFeed(123, 'received', '', undefined, 20)

    expect(result.events).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      'Dropped vote feed event with missing entity',
      expect.objectContaining({ type: 'post', entityId: 10, direction: 'received' }),
    )
  })
})
