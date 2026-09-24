import { APIRequest, APIResponse } from '../../src/api/ApiMiddleware'
import PostController from '../../src/api/PostController'
import { PostGetRequest, PostGetResponse } from '../../src/api/types/requests/PostGet'
import { PostGetCommentsRequest, PostGetCommentsResponse } from '../../src/api/types/requests/PostGetComments'

function createController(restrictedToPostId: number | false = false) {
  const postManager = {
    getPost: jest.fn().mockResolvedValue({ id: 100, author: 42, site: 'main', lastReadCommentId: 10 }),
    getPostCommentIndex: jest.fn().mockResolvedValue([
      { comment_id: 9, parent_comment_id: null, author_id: 8 },
      { comment_id: 11, parent_comment_id: 9, author_id: 8 },
      { comment_id: 12, parent_comment_id: 9, author_id: 7 },
    ]),
    getPostComments: jest.fn(),
    getPostCommentsByIds: jest.fn().mockResolvedValue([{ id: 11, author: 8, post: 100 }]),
    getUserIdOverride: jest.fn().mockResolvedValue(undefined),
  }
  const userManager = {
    getUserRestrictions: jest.fn().mockResolvedValue({ restrictedToPostId, canEditOwnContent: true }),
  }
  const enricher = {
    enrichRawPosts: jest.fn().mockResolvedValue({ posts: [{ id: 100 }], users: {} }),
    enrichRawComments: jest.fn().mockResolvedValue({
      allComments: [{ id: 11, parentComment: 9, answers: [{ id: 99 }] }],
      users: { 8: { id: 8 } },
    }),
    siteInfoToEntity: jest.fn().mockReturnValue({ site: 'main' }),
  }
  const siteManager = { getSiteByNameWithUserInfo: jest.fn().mockResolvedValue({ site: 'main' }) }
  const logger = { error: jest.fn() }
  const oauth = jest.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next())
  const dependencies = [enricher, postManager, {}, siteManager, userManager, {}, oauth, logger]
  const controller = new PostController(...(dependencies as unknown as ConstructorParameters<typeof PostController>))
  const response = { success: jest.fn(), error: jest.fn(), authRequired: jest.fn() }
  return { controller, response, postManager, enricher }
}

describe('threaded post API', () => {
  it('returns a lightweight index and never loads comment bodies for the initial request', async () => {
    const { controller, response, postManager } = createController()
    await controller.postGet(
      {
        session: { data: { userId: 7 } },
        body: { id: 100, commentIndex: true },
      } as unknown as APIRequest<PostGetRequest>,
      response as unknown as APIResponse<PostGetResponse>,
    )

    expect(postManager.getPostComments).not.toHaveBeenCalled()
    expect(response.success).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [],
        commentIndex: [{ id: 9 }, { id: 11, parentComment: 9, isNew: true }, { id: 12, parentComment: 9 }],
      }),
    )
  })

  it('checks access before fetching comment bodies', async () => {
    const { controller, response, postManager } = createController(99)
    await controller.getComments(
      {
        session: { data: { userId: 7 } },
        body: { postId: 100, ids: [11] },
      } as unknown as APIRequest<PostGetCommentsRequest>,
      response as unknown as APIResponse<PostGetCommentsResponse>,
    )

    expect(response.error).toHaveBeenCalledWith('access-denied', expect.any(String), 403)
    expect(postManager.getPostCommentsByIds).not.toHaveBeenCalled()
  })

  it('uses the session user and returns a flat batch', async () => {
    const { controller, response, postManager } = createController()
    await controller.getComments(
      {
        session: { data: { userId: 7 } },
        body: { postId: 100, ids: [11] },
      } as unknown as APIRequest<PostGetCommentsRequest>,
      response as unknown as APIResponse<PostGetCommentsResponse>,
    )

    expect(postManager.getPostCommentsByIds).toHaveBeenCalledWith(100, 7, [11])
    expect(response.success).toHaveBeenCalledWith({
      comments: [{ id: 11, parentComment: 9 }],
      users: { 8: { id: 8 } },
    })
  })
})
