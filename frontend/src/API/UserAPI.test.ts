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
        postTitles: { 10: 'Post 10' },
      },
      hasMore: true,
      nextCursor: 'next',
    })

    const result = await userAPI.userVotes('mine', '', undefined, 20, abortController.signal)

    expect(api.request).toHaveBeenCalledWith(
      '/user/votes',
      { direction: 'mine', cursor: undefined, perpage: 20, filter: '' },
      undefined,
      abortController.signal,
    )
    expect(result).toMatchObject({
      direction: 'mine',
      events: [{ entityId: 10, votedAt: new Date('2026-05-11T10:00:00.000Z') }],
      entities: { posts: { 10: { id: 10 } }, postTitles: { 10: 'Post 10' } },
      hasMore: true,
      nextCursor: 'next',
    })
    expect(postAPIHelper.fixPosts).toHaveBeenCalledTimes(1)
    expect(postAPIHelper.fixCommentsRecords).toHaveBeenCalledTimes(2)
  })

  test('keeps received subjects compact and skips full entity conversion', async () => {
    const { api, postAPIHelper, userAPI } = createUserAPI()
    api.request.mockResolvedValue({
      direction: 'received',
      events: [
        {
          type: 'comment',
          entityId: 20,
          postId: 10,
          vote: 1,
          votedAt: '2026-05-11T10:00:00.000Z',
          voterId: 1,
          targetUserId: 7,
        },
      ],
      users: { 1: user },
      subjects: {
        posts: {},
        comments: { 20: { id: 20, postId: 10, site: 'main', postTitle: 'Post 10', rating: 5 } },
      },
      hasMore: false,
    })

    const result = await userAPI.userVotes('received', '', undefined, 20)

    expect(result).toMatchObject({
      direction: 'received',
      events: [{ entityId: 20, postId: 10, votedAt: new Date('2026-05-11T10:00:00.000Z') }],
      subjects: { comments: { 20: { postTitle: 'Post 10' } } },
    })
    expect(postAPIHelper.fixPosts).not.toHaveBeenCalled()
    expect(postAPIHelper.fixCommentsRecords).not.toHaveBeenCalled()
  })
})
