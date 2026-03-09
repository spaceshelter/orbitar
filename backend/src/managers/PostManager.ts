import { EncryptedPayloadDraftEntity } from '../api/types/entities/EncryptedPayloadEntity'
import CodeError from '../CodeError'
import BookmarkRepository from '../db/repositories/BookmarkRepository'
import CommentRepository from '../db/repositories/CommentRepository'
import PostRepository from '../db/repositories/PostRepository'
import { BookmarkRaw } from '../db/types/BookmarkRaw'
import { CommentRawWithUserData, PostRaw } from '../db/types/PostRaw'
import TheParser from '../parser/TheParser'
import FeedManager from './FeedManager'
import NotificationManager from './NotificationManager'
import SiteManager from './SiteManager'
import TranslationManager from './TranslationManager'
import { CommentInfoWithPostData } from './types/CommentInfo'
import { ContentFormat } from './types/common'
import { HistoryInfo } from './types/HistoryInfo'
import { PostInfo } from './types/PostInfo'
import { SiteInfo } from './types/SiteInfo'
import { UserInfo } from './types/UserInfo'
import UserManager from './UserManager'

export default class PostManager {
  private bookmarkRepository: BookmarkRepository
  private commentRepository: CommentRepository
  private postRepository: PostRepository
  private feedManager: FeedManager
  private notificationManager: NotificationManager
  private siteManager: SiteManager
  private userManager: UserManager
  private translationManager: TranslationManager
  private parser: TheParser

  private numberOfPostsCache: Record<number, ContentNumberCache> = {}
  private numberOfCommentsCache: Record<number, ContentNumberCache> = {}

  constructor(
    bookmarkRepository: BookmarkRepository,
    commentRepository: CommentRepository,
    postRepository: PostRepository,
    feedManager: FeedManager,
    notificationManager: NotificationManager,
    siteManager: SiteManager,
    userManager: UserManager,
    translationManager: TranslationManager,
    parser: TheParser,
  ) {
    this.bookmarkRepository = bookmarkRepository
    this.commentRepository = commentRepository
    this.postRepository = postRepository
    this.feedManager = feedManager
    this.notificationManager = notificationManager
    this.siteManager = siteManager
    this.userManager = userManager
    this.translationManager = translationManager
    this.parser = parser
  }

  async getPost(postId: number, forUserId: number, format: ContentFormat): Promise<PostInfo | undefined> {
    const [rawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId)
    return (await this.feedManager.convertRawPosts(forUserId, [rawPost], format))[0]
  }

  async getPostsByUser(
    userId: number,
    forUserId: number,
    filter: string,
    page: number,
    perpage: number,
    format: ContentFormat,
  ): Promise<PostInfo[]> {
    const posts = await this.postRepository.getPostsByUser(userId, forUserId, filter, page, perpage)
    return await this.feedManager.convertRawPosts(forUserId, posts, format)
  }

  getUserIdByPostId(postId: number): Promise<number | undefined> {
    return this.postRepository.getUserIdByPostId(postId)
  }

  getUserIdByCommentId(commentId: number): Promise<number | undefined> {
    return this.commentRepository.getUserIdByCommentId(commentId)
  }

  getPostWithoutUserData(postId: number): Promise<PostRaw | undefined> {
    return this.postRepository.getPost(postId)
  }

  async getPostsByUserTotal(userId: number, filter = ''): Promise<number> {
    if (!this.numberOfPostsCache[userId]) {
      this.numberOfPostsCache[userId] = new ContentNumberCache()
    }
    return await this.numberOfPostsCache[userId].getOrUpdate(filter, () =>
      this.postRepository.getPostsByUserTotal(userId, filter),
    )
  }

  async createPost(
    siteName: string,
    userId: number,
    title: string,
    content: string,
    format: ContentFormat,
    encryptedPayload?: EncryptedPayloadDraftEntity,
  ): Promise<PostInfo> {
    const site = await this.siteManager.getSiteByName(siteName)
    if (!site) {
      throw new CodeError('no-site', 'Site not found')
    }

    const parseResult = encryptedPayload ? { text: '', mentions: [] } : this.parser.parse(content)
    const language = encryptedPayload ? '' : await this.translationManager.detectLanguage(title, parseResult.text)
    const postRaw = await this.postRepository.createPost(
      site.id,
      userId,
      title,
      encryptedPayload ? '' : content,
      language,
      encryptedPayload ? '' : parseResult.text,
      encryptedPayload,
    )
    this.userManager.clearUserRestrictionsCache(userId)

    await this.bookmarkRepository.setWatch(postRaw.post_id, userId, true)

    for (const mention of parseResult.mentions) {
      await this.notificationManager.sendMentionNotify(mention, userId, postRaw.post_id)
    }

    // fan out in background
    this.feedManager.postFanOut(postRaw.site_id, postRaw.post_id, postRaw.created_at, postRaw.created_at).then().catch()

    delete this.numberOfPostsCache[userId]

    return {
      id: postRaw.post_id,
      site: site.site,
      author: postRaw.author_id,
      created: postRaw.created_at,
      title: postRaw.title,
      content: format === 'html' ? postRaw.html : postRaw.source,
      encryptedPayloadId: postRaw.encrypted_payload_id || undefined,
      rating: 0,
      comments: 0,
      newComments: 0,
      vote: 0,
      bookmark: false,
      watch: true,
    }
  }

  async editPost(
    forUserId: number,
    postId: number,
    title: string | undefined,
    content: string,
    format: ContentFormat,
    encryptedPayload?: EncryptedPayloadDraftEntity,
  ): Promise<PostInfo> {
    let [rawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId)
    if (rawPost.author_id !== forUserId) {
      throw new CodeError('access-denied', 'Access denied')
    }

    // Check edit delay restrictions
    const waitTimeToEditSec = await this.calcTimeToEdit(forUserId, 'post', postId)
    if (waitTimeToEditSec > 0) {
      throw new CodeError('rate-limit', 'Edit rate limit exceeded', 429, { waitSeconds: Math.ceil(waitTimeToEditSec) })
    }

    if (!encryptedPayload && rawPost.source === content && rawPost.title === title) {
      // nothing changed
      const [post] = await this.feedManager.convertRawPosts(forUserId, [rawPost], format)
      return post
    }

    const html = encryptedPayload ? '' : (await this.parser.parse(content)).text
    const language = encryptedPayload ? '' : await this.translationManager.detectLanguage(title, html)

    const updated = await this.postRepository.updatePostText(
      forUserId,
      postId,
      title,
      encryptedPayload ? '' : content,
      language,
      html,
      encryptedPayload,
    )
    if (!updated) {
      throw new CodeError('unknown', 'Could not edit comment')
    }

    ;[rawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId)
    const [post] = await this.feedManager.convertRawPosts(forUserId, [rawPost], format)

    return post
  }

  async getPostComments(postId: number, forUserId: number, format: ContentFormat): Promise<CommentInfoWithPostData[]> {
    const rawComments = await this.commentRepository.getPostComments(postId, forUserId)
    return await this.convertRawCommentsWithPostData(forUserId, rawComments, format)
  }

  async getParentCommentsForASetOfComments(
    comments: CommentInfoWithPostData[],
    forUserId: number,
    format: ContentFormat,
  ): Promise<CommentInfoWithPostData[]> {
    const commentIds = comments.flatMap((comment) => (comment.parentComment ? [comment.parentComment] : []))
    if (!commentIds.length) {
      return []
    }
    const rawComments = await this.commentRepository.getComments(commentIds)
    return await this.convertRawCommentsWithPostData(forUserId, rawComments, format)
  }

  async getUserComments(
    userId: number,
    forUserId: number,
    filter: string,
    page: number,
    perpage: number,
    format: ContentFormat,
  ): Promise<CommentInfoWithPostData[]> {
    const rawComments = await this.commentRepository.getUserComments(userId, forUserId, filter, page, perpage)
    return await this.convertRawCommentsWithPostData(forUserId, rawComments, format)
  }

  private async updateCommentsHtmlAndParserVersionInBatches(toUpdate: { id: number; html: string }[]) {
    const batchSize = 128

    const updateIdsOnly = toUpdate.filter((comment) => comment.html === undefined).map((comment) => comment.id)
    for (let i = 0; i < updateIdsOnly.length; i += batchSize) {
      const batch = updateIdsOnly.slice(i, i + batchSize)
      await this.commentRepository.updateCommentsParserVersion(batch, TheParser.VERSION)
    }

    toUpdate = toUpdate.filter((comment) => comment.html !== undefined)

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize)
      await this.commentRepository.updateCommentsHtmlAndParserVersion(batch, TheParser.VERSION)
    }
  }

  private async convertRawCommentsWithPostData(
    forUserId: number,
    rawComments: CommentRawWithUserData[],
    format: ContentFormat,
  ): Promise<CommentInfoWithPostData[]> {
    const siteById: Record<number, SiteInfo> = {}
    const comments: CommentInfoWithPostData[] = []
    const postsToUpdateHtmlAndParserVersion: { id: number; html: string }[] = []

    for (const raw of rawComments) {
      let site = siteById[raw.site_id]
      if (!site) {
        site = await this.siteManager.getSiteById(raw.site_id)
        siteById[raw.site_id] = site
      }

      if (!raw.encrypted_payload_id && raw.parser_version !== TheParser.VERSION) {
        const html = this.parser.parse(raw.source).text
        raw.parser_version = TheParser.VERSION
        postsToUpdateHtmlAndParserVersion.push({
          id: raw.comment_id,
          html: raw.html !== html ? html : undefined,
        })
        raw.html = html
      }

      const comment: CommentInfoWithPostData = {
        id: raw.comment_id,
        post: raw.post_id,
        site: site ? site.site : '',
        content: format === 'html' ? raw.html : raw.source,
        encryptedPayloadId: raw.encrypted_payload_id || undefined,
        author: raw.author_id,
        created: raw.created_at,
        rating: raw.rating,
        parentComment: raw.parent_comment_id,
        language: raw.language,

        vote: raw.vote,
      }
      if (raw.deleted) {
        comment.deleted = true
      }
      if (raw.author_id === forUserId) {
        comment.canEdit = true
      }
      if (raw.edit_flag) {
        comment.editFlag = raw.edit_flag
      }

      comments.push(comment)
    }

    if (postsToUpdateHtmlAndParserVersion.length) {
      // update in background
      this.updateCommentsHtmlAndParserVersionInBatches(postsToUpdateHtmlAndParserVersion).then().catch()
    }

    return comments
  }

  async getUserCommentsTotal(userId: number, filter = ''): Promise<number> {
    if (!this.numberOfCommentsCache[userId]) {
      this.numberOfCommentsCache[userId] = new ContentNumberCache()
    }
    return await this.numberOfCommentsCache[userId].getOrUpdate(filter, () =>
      this.commentRepository.getUserCommentsTotal(userId, filter),
    )
  }

  async createComment(
    userId: number,
    postId: number,
    parentCommentId: number | undefined,
    content: string,
    format: ContentFormat,
    encryptedPayload: EncryptedPayloadDraftEntity | undefined,
    notificationOptions: {
      bumpFeed: boolean
      sendNotifications: boolean
    },
  ): Promise<CommentInfoWithPostData> {
    const parseResult = encryptedPayload ? { text: '', mentions: [] } : this.parser.parse(content)
    const language = encryptedPayload ? '' : await this.translationManager.detectLanguage('', parseResult.text)
    const { bumpFeed, sendNotifications } = notificationOptions

    const commentRaw = await this.commentRepository.createComment(
      userId,
      postId,
      parentCommentId,
      encryptedPayload ? '' : content,
      language,
      encryptedPayload ? '' : parseResult.text,
      encryptedPayload,
      bumpFeed,
    )
    this.userManager.clearUserRestrictionsCache(userId)

    if (sendNotifications && !encryptedPayload) {
      let parentAuthor: UserInfo | undefined
      if (parentCommentId) {
        const parentComment = await this.commentRepository.getComment(parentCommentId)
        parentAuthor = await this.userManager.getById(parentComment.author_id)
      }
      for (const mention of parseResult.mentions) {
        // if author of parent comment/post was mentioned - do not send notifications:
        // they are already notified about answer to their comment
        if (mention === parentAuthor?.username.toLowerCase()) {
          continue
        }
        await this.notificationManager.sendMentionNotify(mention, userId, postId, commentRaw.comment_id)
      }

      if (parentAuthor) {
        await this.notificationManager.sendAnswerNotify(parentAuthor.id, userId, postId, commentRaw.comment_id)
      }
    }

    await this.bookmarkRepository.setWatch(postId, userId, true)
    this.userManager.clearUserStatsCache()

    // fan out in background
    this.feedManager
      .postFanOut(
        commentRaw.site_id,
        commentRaw.post_id,
        undefined,
        commentRaw.created_at,
        /*onlyDbUpdate=*/ !bumpFeed, // note, currently this will update Watch feed (bookmarks) in any case!
      )
      .then()
      .catch()

    const comments = await this.convertRawCommentsWithPostData(userId, [commentRaw], format)
    delete this.numberOfCommentsCache[userId]
    return comments[0]
  }

  async getComment(
    forUserId: number,
    commentId: number,
    format: ContentFormat,
  ): Promise<CommentInfoWithPostData | undefined> {
    const rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId)
    const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format)
    return comment
  }

  async editComment(
    forUserId: number,
    commentId: number,
    content: string,
    format: ContentFormat,
    encryptedPayload?: EncryptedPayloadDraftEntity,
  ): Promise<CommentInfoWithPostData> {
    let rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId)
    if (rawComment.author_id !== forUserId) {
      throw new CodeError('access-denied', 'Access denied')
    }

    // Check edit delay restrictions
    const waitTimeToEditSec = await this.calcTimeToEdit(forUserId, 'comment', commentId)
    if (waitTimeToEditSec > 0) {
      throw new CodeError('rate-limit', 'Edit rate limit exceeded', 429, { waitSeconds: Math.ceil(waitTimeToEditSec) })
    }

    if (!encryptedPayload && rawComment.source === content) {
      // nothing changed
      const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format)
      return comment
    }

    const html = encryptedPayload ? '' : (await this.parser.parse(content)).text
    const language = encryptedPayload ? '' : await this.translationManager.detectLanguage('', html)

    const updated = await this.commentRepository.updateCommentText(
      forUserId,
      commentId,
      encryptedPayload ? '' : content,
      language,
      html,
      encryptedPayload,
    )
    if (!updated) {
      throw new CodeError('unknown', 'Could not edit comment')
    }

    rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId)
    const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format)
    return comment
  }

  private async calcTimeToEdit(userId: number, contentType: 'post' | 'comment', contentId: number): Promise<number> {
    const restrictions = await this.userManager.getUserRestrictions(userId)

    if (!restrictions.editSlowModeEnabled) {
      return 0
    }

    const { lastEditTime, numberOfEdits } = await this.postRepository.getEditStats(userId, contentType, contentId)

    // Base delay: 5 minutes, doubling with each edit
    const baseDelay = 5 * 60 // 5 minutes in seconds
    // Prevent overflow: 2^53 is the max safe integer, so limit exponent
    const editDelay = baseDelay * Math.pow(2, Math.min(numberOfEdits, 50))

    if (!lastEditTime) {
      return 0 // No previous edits, no delay
    }

    const timeSinceLastEdit = (Date.now() - lastEditTime.getTime()) / 1000
    return Math.max(0, editDelay - timeSinceLastEdit)
  }

  async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number): Promise<boolean> {
    const changedNotifications = await this.notificationManager.setReadForPost(userId, postId)
    const changedBookmarks = await this.bookmarkRepository.setRead(postId, userId, readComments, lastCommentId)
    return changedNotifications || changedBookmarks
  }

  preview(content: string): string {
    return this.parser.parse(content).text
  }

  getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
    return this.bookmarkRepository.getBookmark(postId, userId)
  }

  setBookmark(postId: number, userId: number, bookmarked: boolean) {
    return this.bookmarkRepository.setBookmark(postId, userId, bookmarked)
  }

  setWatch(postId: number, userId: number, bookmarked: boolean) {
    return this.bookmarkRepository.setWatch(postId, userId, bookmarked)
  }

  async getHistory(forUserId: number, id: number, type: string, format: ContentFormat): Promise<HistoryInfo[]> {
    const rawSources = await this.postRepository.getContentSources(id, type)
    const sources: HistoryInfo[] = []

    for (const rawSource of rawSources) {
      let content = rawSource.source
      if (!rawSource.encrypted_payload_id && format === 'html') {
        content = (await this.parser.parse(content)).text
      }

      const source: HistoryInfo = {
        id: rawSource.content_source_id,
        content,
        encryptedPayloadId: rawSource.encrypted_payload_id || undefined,
        title: rawSource.title,
        comment: rawSource.comment,
        date: rawSource.created_at,
        changed: 0,
        editor: rawSource.author_id,
      }
      sources.push(source)
    }

    return sources
  }

  /**
   * Returns the user id that should be used for the given post.
   * (anonymous posts mechanism)
   * @param postId
   */
  getUserIdOverride(postId: number): Promise<number | undefined> {
    return this.postRepository.getUserIdOverride(postId)
  }

  getLastUserComment(userId: number) {
    return this.commentRepository.getLastUserComment(userId)
  }

  clearUserContentCaches(userId: number) {
    delete this.numberOfPostsCache[userId]
    delete this.numberOfCommentsCache[userId]
  }
}

class ContentNumberCache {
  filtered?: [string, number]
  total?: number

  async getOrUpdate(filter: string, set: () => Promise<number>): Promise<number> {
    if (filter !== '') {
      if (this.filtered && this.filtered[0] === filter) {
        return this.filtered[1]
      }
      this.filtered = [filter, await set()]
      return this.filtered[1]
    }
    if (this.total === undefined) {
      this.total = await set()
    }
    return this.total
  }
}
