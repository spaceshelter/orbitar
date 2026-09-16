import UserAPI from './UserAPI'

describe('UserAPI.userVotes', () => {
  const user = { id: 7, username: 'user-7', name: 'User 7', gender: 0, karma: 3 }

  const createUserAPI = () => {
    const api = {
      request: jest.fn(),
      fixDate: jest.fn((date: Date) => date),
    }
    const postAPIHelper = {
      fixPosts: jest.fn((posts: Array<Record<string, unknown> & { created: string }>) =>
        posts.map((post) => ({ ...post, created: new Date(post.created) })),
      ),
      fixCommentsRecords: jest.fn((comments: Record<number, unknown>) => comments),
    }
    return {
      api,
      postAPIHelper,
      userAPI: new UserAPI(api as never, postAPIHelper as never),
    }
  }

  test('converts normalized mine maps and forwards the abort signal', async () => {
    const { api, postAPIHelper, userAPI } = createUserAPI()
    const abortController = new AbortController()
    api.request.mockResolvedValue({
      direction: 'mine',
      events: [
        {
          type: 'post',
          entityId: 10,
          postId: 10,
          vote: 1,
          votedAt: '2026-05-11T10:00:00.000Z',
          voterId: 1,
          targetUserId: 7,
        },
      ],
      users: { 7: user },
      entities: {
        posts: { 10: { id: 10, author: 7, created: '2026-05-10T10:00:00.000Z' } },
        comments: {},
        parentComments: {},
      },
      hasMore: true,
      nextCursor: 'next',
    })

    const result = await userAPI.userVotes('', undefined, 20, abortController.signal)

    expect(api.request).toHaveBeenCalledWith(
      '/user/votes',
      { direction: 'mine', cursor: undefined, perpage: 20, filter: '' },
      undefined,
      abortController.signal,
    )
    expect(result).toMatchObject({
      direction: 'mine',
      events: [{ entityId: 10, votedAt: new Date('2026-05-11T10:00:00.000Z') }],
      entities: { posts: { 10: { id: 10 } } },
      hasMore: true,
      nextCursor: 'next',
    })
    expect(postAPIHelper.fixPosts).toHaveBeenCalledTimes(1)
    expect(postAPIHelper.fixCommentsRecords).toHaveBeenCalledTimes(2)
  })

  test('receivedVotes sends type, sign and an ISO lower bound and keeps subjects compact', async () => {
    const { api, postAPIHelper, userAPI } = createUserAPI()
    const abortController = new AbortController()
    const subjects = {
      posts: {},
      comments: {
        20: { id: 20, postId: 10, site: 'main', postTitle: 'Post 10', excerpt: 'Хорошее уточнение', rating: 5 },
      },
    }
    api.request.mockResolvedValue({
      direction: 'received',
      events: [
        {
          type: 'comment',
          entityId: 20,
          postId: 10,
          vote: -1,
          votedAt: '2026-09-15T10:00:00.000Z',
          voterId: 1,
          targetUserId: 7,
        },
      ],
      users: { 1: user },
      subjects,
      hasMore: true,
      nextCursor: 'next',
    })

    const result = await userAPI.receivedVotes(
      { type: 'comment', sign: 'minus', since: new Date('2026-09-03T00:00:00.000Z'), cursor: 'prev', perpage: 200 },
      abortController.signal,
    )

    expect(api.request).toHaveBeenCalledWith(
      '/user/votes',
      {
        direction: 'received',
        type: 'comment',
        sign: 'minus',
        since: '2026-09-03T00:00:00.000Z',
        cursor: 'prev',
        perpage: 200,
      },
      undefined,
      abortController.signal,
    )
    expect(result).toEqual({
      direction: 'received',
      events: [
        {
          type: 'comment',
          entityId: 20,
          postId: 10,
          vote: -1,
          votedAt: new Date('2026-09-15T10:00:00.000Z'),
          voterId: 1,
          targetUserId: 7,
        },
      ],
      users: { 1: user },
      subjects,
      hasMore: true,
      nextCursor: 'next',
    })
    expect(postAPIHelper.fixPosts).not.toHaveBeenCalled()
    expect(postAPIHelper.fixCommentsRecords).not.toHaveBeenCalled()
  })
})
