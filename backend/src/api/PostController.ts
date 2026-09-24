import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { APIError, AuthenticationError, RateLimitError } from 'openai'
import { Logger } from 'winston'

import CodeError from '../CodeError'
import ActivityManager from '../managers/ActivityManager'
import FeedManager from '../managers/FeedManager'
import PostManager from '../managers/PostManager'
import SiteManager from '../managers/SiteManager'
import TranslationManager, { TRANSLATION_LANGUAGES, TRANSLATION_MODES } from '../managers/TranslationManager'
import UserManager from '../managers/UserManager'
import { APIRequest, APIResponse, joiFormat, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { commonRateLimitConfig, sharedReadRateLimiter } from './RateLimiters'
import { CommentEntity } from './types/entities/CommentEntity'
import { HistoryEntity } from './types/entities/HistoryEntity'
import { UserEntity } from './types/entities/UserEntity'
import {
  GetPublicKeyByUsernameRequest,
  GetPublicKeyByUsernameResponse,
} from './types/requests/GetPublicKeyByPostOrComment'
import { PostBookmarkRequest, PostBookmarkResponse } from './types/requests/PostBookmark'
import { PostCommentRequest, PostCommentResponse } from './types/requests/PostComment'
import { PostCreateRequest, PostCreateResponse } from './types/requests/PostCreate'
import { PostEditRequest, PostEditResponse } from './types/requests/PostEdit'
import { PostCommentEditRequest, PostCommentEditResponse } from './types/requests/PostEditComment'
import { PostGetRequest, PostGetResponse } from './types/requests/PostGet'
import { PostGetCommentRequest, PostGetCommentResponse } from './types/requests/PostGetComment'
import { PostHistoryRequest, PostHistoryResponse } from './types/requests/PostHistory'
import { PostReadRequest, PostReadResponse } from './types/requests/PostRead'
import { PostWatchRequest, PostWatchResponse } from './types/requests/PostWatch'
import { PostPreviewRequest, PostPreviewResponse } from './types/requests/Preview'
import { TranslateRequest, TranslateResponse } from './types/requests/Translate'
import { Enricher } from './utils/Enricher'

export default class PostController {
  public readonly router = Router()
  private readonly postManager: PostManager
  private readonly feedManager: FeedManager
  private readonly userManager: UserManager
  private readonly siteManager: SiteManager
  private readonly translationManager: TranslationManager
  private readonly activityManager: ActivityManager
  private readonly logger: Logger
  private readonly enricher: Enricher

  // 5 per hour
  private readonly postCreateRateLimiter = rateLimit({
    max: 5,
    windowMs: 3600 * 1000,
    ...commonRateLimitConfig,
  })

  /* 40/(30 mins) */
  private readonly postEditRateLimiter = rateLimit({
    max: 40,
    windowMs: 30 * 60 * 1000,
    ...commonRateLimitConfig,
  })

  /* 40/(30 mins) */
  private readonly commentRateLimiter = rateLimit({
    max: 40,
    windowMs: 30 * 60 * 1000,
    ...commonRateLimitConfig,
  })

  /* 20/min — translate calls external AI APIs */
  private readonly translateRateLimiter = rateLimit({
    max: 20,
    windowMs: 60 * 1000,
    ...commonRateLimitConfig,
  })

  constructor(
    enricher: Enricher,
    postManager: PostManager,
    feedManager: FeedManager,
    siteManager: SiteManager,
    userManager: UserManager,
    translationManager: TranslationManager,
    activityManager: ActivityManager,
    oauth: OAuth2MiddlewareGenerator,
    logger: Logger,
  ) {
    this.enricher = enricher
    this.postManager = postManager
    this.userManager = userManager
    this.siteManager = siteManager
    this.feedManager = feedManager
    this.translationManager = translationManager
    this.activityManager = activityManager
    this.logger = logger

    const getSchema = Joi.object<PostGetRequest>({
      id: Joi.number().required(),
      format: joiFormat,
      noComments: Joi.boolean().default(false),
    })
    const readSchema = Joi.object<PostReadRequest>({
      post_id: Joi.number().required(),
      comments: Joi.number().required(),
      last_comment_id: Joi.number().optional(),
    })
    const postCreateSchema = Joi.object<PostCreateRequest>({
      site: Joi.string().required(),
      title: Joi.alternatives(Joi.string().max(64), Joi.valid('').optional()),
      content: Joi.string().min(1).max(50000).required(),
      format: joiFormat,
    })
    const commentSchema = Joi.object<PostCommentRequest>({
      comment_id: Joi.number().optional(),
      post_id: Joi.number().required(),
      content: Joi.string().min(1).max(50000).required(),
      format: joiFormat,
    })
    const previewSchema = Joi.object<PostPreviewRequest>({
      content: Joi.string().min(1).max(50000).required(),
    })
    const bookmarkSchema = Joi.object<PostBookmarkRequest>({
      post_id: Joi.number().required(),
      bookmark: Joi.boolean().required(),
    })
    const watchingSchema = Joi.object<PostWatchRequest>({
      post_id: Joi.number().required(),
      watch: Joi.boolean().required(),
    })
    const getCommentSchema = Joi.object<PostGetCommentRequest>({
      id: Joi.number().required(),
      format: joiFormat,
    })
    const editCommentSchema = Joi.object<PostCommentEditRequest>({
      id: Joi.number().required(),
      content: Joi.string().min(1).max(50000).required(),
      format: joiFormat,
    })
    const editSchema = Joi.object<PostEditRequest>({
      id: Joi.number().required(),
      title: Joi.alternatives(Joi.string().max(64), Joi.valid('').optional()),
      content: Joi.string().min(1).max(50000).required(),
      format: joiFormat,
    })
    const translateSchema = Joi.object<TranslateRequest>({
      id: Joi.number().required(),
      type: Joi.string().valid('post', 'comment').required(),
      mode: Joi.string()
        .valid(...TRANSLATION_MODES)
        .required(),
      language: Joi.string()
        .valid(...Object.keys(TRANSLATION_LANGUAGES))
        .optional(),
    })
    const historySchema = Joi.object<PostHistoryRequest>({
      id: Joi.number().required(),
      type: Joi.valid('post', 'comment').required(),
      format: joiFormat,
    })
    const getPostPublicKeySchema = Joi.object<GetPublicKeyByUsernameRequest>({
      username: Joi.string().required(),
    })

    this.router.post('/post/get', sharedReadRateLimiter, validate(getSchema), oauth('читать посты'), (req, res) =>
      this.postGet(req, res),
    )
    this.router.post(
      '/post/create',
      this.postCreateRateLimiter,
      validate(postCreateSchema),
      oauth('создавать посты'),
      (req, res) => this.create(req, res),
    )
    this.router.post(
      '/post/edit',
      this.postEditRateLimiter,
      validate(editSchema),
      oauth('редактировать посты'),
      (req, res) => this.postEdit(req, res),
    )
    this.router.post(
      '/post/comment',
      this.commentRateLimiter,
      validate(commentSchema),
      oauth('комментировать в постах'),
      (req, res) => this.comment(req, res),
    )
    this.router.post(
      '/post/preview',
      sharedReadRateLimiter,
      validate(previewSchema),
      oauth('превью контента (парсер)'),
      (req, res) => this.preview(req, res),
    )
    this.router.post(
      '/post/read',
      sharedReadRateLimiter,
      validate(readSchema),
      oauth('помечать посты как прочитанные'),
      (req, res) => this.read(req, res),
    )
    this.router.post(
      '/post/bookmark',
      sharedReadRateLimiter,
      validate(bookmarkSchema),
      oauth('отслеживать посты'),
      (req, res) => this.bookmark(req, res),
    )
    this.router.post(
      '/post/watch',
      sharedReadRateLimiter,
      validate(watchingSchema),
      oauth('следить за постами'),
      (req, res) => this.watch(req, res),
    )
    this.router.post(
      '/post/translate',
      this.translateRateLimiter,
      validate(translateSchema),
      oauth('AI-действия с контентом'),
      (req, res) => this.translate(req, res),
    )
    this.router.post(
      '/post/get-comment',
      sharedReadRateLimiter,
      validate(getCommentSchema),
      oauth('читать комментарии поста'),
      (req, res) => this.getComment(req, res),
    )
    this.router.post(
      '/post/edit-comment',
      this.commentRateLimiter,
      oauth('редактировать комментарии'),
      validate(editCommentSchema),
      (req, res) => this.editComment(req, res),
    )
    this.router.post(
      '/post/history',
      sharedReadRateLimiter,
      validate(historySchema),
      oauth('смотреть историю редактирования'),
      (req, res) => this.history(req, res),
    )
    this.router.post(
      '/post/get-public-key',
      sharedReadRateLimiter,
      validate(getPostPublicKeySchema),
      oauth('получать публичный ключ автора поста'),
      (req, res) => this.getPublicKeyByUsername(req, res),
    )
  }

  async postGet(request: APIRequest<PostGetRequest>, response: APIResponse<PostGetResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { id: postId, format, noComments } = request.body

    try {
      const rawPost = await this.postManager.getPost(postId, userId, format)
      if (!rawPost) {
        return response.error('no-post', 'Post not found')
      }

      const site = await this.siteManager.getSiteByNameWithUserInfo(userId, rawPost.site)
      if (!site) {
        return response.error('error', 'Unknown error', 500)
      }

      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (restrictions.restrictedToPostId !== false && rawPost.author !== userId) {
        return response.error('access-denied', "You don't have permission to view this post", 403)
      }

      const {
        posts: [post],
        users,
      } = await this.enricher.enrichRawPosts([rawPost])
      if (!restrictions.canEditOwnContent) {
        post.canEdit = false
      }

      let comments: CommentEntity[] = []
      if (!noComments) {
        const rawComments = await this.postManager.getPostComments(postId, userId, format)

        if (!restrictions.canEditOwnContent) {
          rawComments.forEach((comment) => (comment.canEdit = false))
        }

        const { rootComments } = await this.enricher.enrichRawComments(
          rawComments,
          users,
          format,
          (comment) => comment.author !== userId && comment.id > rawPost.lastReadCommentId,
        )
        comments = rootComments
      }

      const userIdOverride = await this.postManager.getUserIdOverride(postId)
      const userIdOverrideEntity = userIdOverride && (await this.userManager.getById(userIdOverride))

      response.success({
        post: post,
        site: this.enricher.siteInfoToEntity(site),
        comments: comments,
        users: users,
        anonymousUser: userIdOverrideEntity,
      })
    } catch (err) {
      this.logger.error('Post get error', { error: err, post_id: postId })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async postEdit(request: APIRequest<PostEditRequest>, response: APIResponse<PostEditResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { id, title, format, content } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (!restrictions.canEditOwnContent) {
        return response.error('access-denied', 'Access-denied', 403)
      }

      const postInfo = await this.postManager.editPost(userId, id, title, content, format)
      if (!postInfo) {
        return response.error('no-comment', 'Post not found')
      }

      const {
        posts: [post],
        users,
      } = await this.enricher.enrichRawPosts([postInfo])

      const user = await this.userManager.getById(userId)
      this.activityManager.push({
        type: 'post:edited',
        userId,
        username: user.username,
        postId: id,
        site: postInfo.site,
      })

      this.logger.info(`Post edited by #${userId}`, { user_id: userId, post_id: id, format, content, title })
      response.success({ post, users })
    } catch (err) {
      this.logger.error('Post edit error', { error: err, user_id: userId, post_id: id, format, content, title })
      this.logger.error(err)

      if (err instanceof CodeError && err.code === 'access-denied') {
        return response.error('access-denied', 'Access-denied')
      }

      if (err instanceof CodeError && err.code === 'rate-limit') {
        return response.error('rate-limit', err.message, err.statusCode || 429, err.meta)
      }

      return response.error('error', 'Unknown error', 500)
    }
  }

  async create(request: APIRequest<PostCreateRequest>, response: APIResponse<PostCreateResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { site, format, content, title } = request.body

    try {
      const userRestrictions = await this.userManager.getUserRestrictions(userId)
      if (userRestrictions.postSlowModeWaitSecRemain !== 0) {
        return response.error(
          'slow-mode',
          `Slow mode is enabled. Time left ${userRestrictions.postSlowModeWaitSecRemain} seconds.`,
          403,
        )
      }
      if (userRestrictions.restrictedToPostId && userRestrictions.restrictedToPostId !== true) {
        return response.error('post-creation-restricted', 'You cannot create any more posts due to low karma.', 403)
      }

      const postInfo = await this.postManager.createPost(site, userId, title, content, format)
      const {
        posts: [post],
      } = await this.enricher.enrichRawPosts([postInfo])

      const user = await this.userManager.getById(userId)
      this.activityManager.push({
        type: 'post:created',
        userId,
        username: user.username,
        postId: postInfo.id,
        site,
      })

      this.logger.info(`Post created by #${userId}`, { user_id: userId, site, format, content, title })
      response.success({ post })
    } catch (err) {
      this.logger.error('Post create failed', { error: err, user_id: userId, site, format, content, title })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  preview(request: APIRequest<PostPreviewRequest>, response: APIResponse<PostPreviewResponse>) {
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }
    const content = request.body.content
    try {
      const result = this.postManager.preview(content)
      response.success({ content: result })
    } catch (err) {
      this.logger.error('Comment create failed', { error: err, user_id: userId, content })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async comment(request: APIRequest<PostCommentRequest>, response: APIResponse<PostCommentResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { post_id: postId, comment_id: parentCommentId, format, content } = request.body

    try {
      const userRestrictions = await this.userManager.getUserRestrictions(userId)
      if (userRestrictions.commentSlowModeWaitSecRemain > 0) {
        return response.error(
          'slow-mode',
          `Slow mode, time left ${userRestrictions.commentSlowModeWaitSecRemain} sec`,
          403,
        )
      }
      if (userRestrictions.restrictedToPostId && postId !== userRestrictions.restrictedToPostId) {
        const rid = userRestrictions.restrictedToPostId
        return response.error(
          'restricted',
          `Commenting restricted ${rid === true ? 'to own posts' : `to post #${rid}`}`,
          403,
        )
      }

      const postAuthorId = await this.postManager.getUserIdByPostId(postId)
      const postAuthorRestrictions = await this.userManager.getUserRestrictions(postAuthorId)

      const overrideUserId = (await this.postManager.getUserIdOverride(postId)) || userId

      // feed bump when post author is not fully karmadead
      const bumpFeed = postAuthorRestrictions.restrictedToPostId === false

      // send notifications when commenter is not fully karmadead
      const sendNotifications = userRestrictions.restrictedToPostId === false

      const commentInfo = await this.postManager.createComment(
        overrideUserId,
        postId,
        parentCommentId,
        content,
        format,
        {
          bumpFeed,
          sendNotifications,
        },
      )
      const {
        allComments: [comment],
      } = await this.enricher.enrichRawComments([commentInfo], {}, format, () => true)
      comment.canEdit = overrideUserId === userId

      const users: Record<number, UserEntity> = { [overrideUserId]: await this.userManager.getById(overrideUserId) }

      this.activityManager.push({
        type: 'comment:created',
        userId: overrideUserId,
        username: users[overrideUserId].username,
        postId,
        commentId: commentInfo.id,
      })

      this.logger.info(`Comment created by #${overrideUserId} @${users[overrideUserId].username}`, {
        comment: content,
        username: users[overrideUserId].username,
        user_id: overrideUserId,
      })

      response.success({
        comment,
        users,
      })
    } catch (err) {
      this.logger.error('Comment create failed', { error: err, user_id: userId, format, content, post_id: postId })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async read(request: APIRequest<PostReadRequest>, response: APIResponse<PostReadResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { post_id: postId, comments, last_comment_id: lastCommentId } = request.body

    const readUpdated = await this.postManager.setRead(postId, userId, comments, lastCommentId)

    if (readUpdated) {
      this.userManager.deleteUserStatsCache(userId)
      const status = await this.userManager.getUserStats(userId)
      return response.success({
        notifications: status.notifications,
        watch: status.watch,
      })
    }

    response.success({})
  }

  async bookmark(request: APIRequest<PostBookmarkRequest>, response: APIResponse<PostBookmarkResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { post_id: postId, bookmark } = request.body

    try {
      await this.postManager.setBookmark(postId, userId, bookmark)
      response.success({ bookmark: bookmark })
    } catch (err) {
      this.logger.error('Bookmark failed', { error: err, user_id: userId, post_id: postId, bookmark })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async watch(request: APIRequest<PostWatchRequest>, response: APIResponse<PostWatchResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { post_id: postId, watch } = request.body

    try {
      await this.postManager.setWatch(postId, userId, watch)
      this.userManager.deleteUserStatsCache(userId)
      response.success({ watch })
    } catch (err) {
      this.logger.error('Watch failed', { error: err, user_id: userId, post_id: postId, watch })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getComment(request: APIRequest<PostGetCommentRequest>, response: APIResponse<PostGetCommentResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { id: commentId, format } = request.body

    try {
      const commentInfo = await this.postManager.getComment(userId, commentId, format)
      if (!commentInfo) {
        return response.error('no-comment', 'Comment not found')
      }

      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (restrictions.restrictedToPostId && restrictions.restrictedToPostId !== commentInfo.post) {
        // simplification, but currently getComment is used only for editing, so it's ok
        return response.error('access-denied', `Commenting restricted to post #${restrictions.restrictedToPostId}`, 403)
      }

      const {
        allComments: [comment],
        users,
      } = await this.enricher.enrichRawComments([commentInfo], {}, format, () => false)

      response.success({
        comment: comment,
        users: users,
      })
    } catch (err) {
      this.logger.error('Comment get error', { error: err, comment_id: commentId })
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async editComment(request: APIRequest<PostCommentEditRequest>, response: APIResponse<PostCommentEditResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { id: commentId, content, format } = request.body

    try {
      const userRestrictions = await this.userManager.getUserRestrictions(userId)
      if (!userRestrictions.canEditOwnContent) {
        return response.error('restricted', 'Editing restricted', 403)
      }

      const commentInfo = await this.postManager.editComment(userId, commentId, content, format)
      if (!commentInfo) {
        return response.error('no-comment', 'Comment not found')
      }

      const {
        allComments: [comment],
        users,
      } = await this.enricher.enrichRawComments([commentInfo], {}, format, () => false)

      const user = await this.userManager.getById(userId)
      this.activityManager.push({
        type: 'comment:edited',
        userId,
        username: user.username,
        postId: commentInfo.post,
        commentId,
      })

      response.success({
        comment: comment,
        users: users,
      })
    } catch (err) {
      this.logger.error('Comment edit error', { error: err, comment_id: commentId })
      this.logger.error(err)

      if (err instanceof CodeError && err.code === 'access-denied') {
        return response.error('access-denied', 'Access-denied')
      }

      if (err instanceof CodeError && err.code === 'rate-limit') {
        return response.error('rate-limit', err.message, err.statusCode || 429, err.meta)
      }

      return response.error('error', 'Unknown error', 500)
    }
  }

  async translate(request: APIRequest<TranslateRequest>, response: APIResponse<TranslateResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { id, type, mode, language } = request.body
    try {
      const restrictions = await this.userManager.getUserRestrictions(request.session.data.userId)
      if (restrictions.restrictedToPostId !== false) {
        // simplification, just disallows the translation
        return response.error('access-denied', `Translation is not allowed.`, 403)
      }

      // Validate that language is provided when mode is 'translate'
      if (mode === 'translate' && !language) {
        return response.error('invalid-params', 'Language is required for translation mode', 400)
      }

      await this.translationManager.translateEntity(id, type, mode, (chunk) => response.write(chunk), language)
      response.end()
    } catch (err) {
      let msg = 'Unknown error'
      if (err instanceof AuthenticationError) {
        msg = 'OpenAI AuthenticationError'
      } else if (err instanceof RateLimitError) {
        msg = 'OpenAI RateLimitError'
      } else if (err instanceof APIError) {
        msg = 'OpenAI error'
      }
      this.logger.error(err)
      try {
        response.error('error', msg, 500)
      } catch (err) {
        // in case some chunks were already written
        // should not happen now, just a precaution if the invariant in translateEntity is broken
        this.logger.error('Error writing response')
        this.logger.error(err)
        try {
          response.write('{"result":"error","code":"error"}')
        } finally {
          response.end()
        }
      }
    }
  }

  async history(request: APIRequest<PostHistoryRequest>, response: APIResponse<PostHistoryResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { id, type, format } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (restrictions.restrictedToPostId !== false) {
        return response.error('access-denied', 'Access-denied', 403)
      }

      const historyInfos = await this.postManager.getHistory(userId, id, type, format)

      const history: HistoryEntity[] = historyInfos.map((h) => ({
        id: h.id,
        title: h.title,
        comment: h.comment,
        content: h.content,
        date: h.date.toISOString(),
        editor: h.editor,
        changed: h.changed,
      }))

      response.success({
        history,
      })
    } catch (err) {
      this.logger.error('History request error', { error: err, ref_id: id, ref_type: type })
      this.logger.error(err)

      if (err instanceof CodeError && err.code === 'access-denied') {
        return response.error('access-denied', 'Access-denied')
      }

      return response.error('error', 'Unknown error', 500)
    }
  }

  private async getPublicKeyByUsername(
    req: APIRequest<GetPublicKeyByUsernameRequest>,
    res: APIResponse<GetPublicKeyByUsernameResponse>,
  ) {
    const { username } = req.body
    const targetUser = await this.userManager.getByUsername(username)

    if (!targetUser) {
      return res.success({ publicKey: undefined })
    }
    const publicKey = await this.userManager.getPublicKey(targetUser.id)
    return res.success({ publicKey })
  }
}
