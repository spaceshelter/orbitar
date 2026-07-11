import { stripHtml } from 'string-strip-html'
import { Logger } from 'winston'

import { CommentEntity } from '../api/types/entities/CommentEntity'
import { PostEntity } from '../api/types/entities/PostEntity'
import { UserEntity, UserGender } from '../api/types/entities/UserEntity'
import {
  ReceivedCommentSubject,
  ReceivedPostSubject,
  UserVoteFeedEventRef,
  UserVotesResponse,
} from '../api/types/requests/UserVotes'
import VoteFeedReadRepository, {
  VoteFeedCursor,
  VoteFeedDirection,
  VoteFeedReference,
} from '../db/repositories/VoteFeedReadRepository'
import PostManager from './PostManager'
import { CommentInfoWithPostData } from './types/CommentInfo'
import { PostInfo } from './types/PostInfo'
import { UserInfo } from './types/UserInfo'
import UserManager from './UserManager'

export class InvalidVoteFeedCursorError extends Error {
  constructor() {
    super('Invalid vote feed cursor')
  }
}

const VOTE_FEED_ENTITY_TYPES = ['post', 'comment', 'user']

export const encodeVoteFeedCursor = (ref: VoteFeedReference): string =>
  Buffer.from(
    JSON.stringify({
      votedAt: ref.votedAt.getTime(),
      type: ref.type,
      entityId: ref.entityId,
      voterId: ref.voterId,
    }),
  ).toString('base64url')

export const decodeVoteFeedCursor = (cursor: string): VoteFeedCursor => {
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw new InvalidVoteFeedCursorError()
  }

  const votedAt = typeof parsed?.votedAt === 'number' ? new Date(parsed.votedAt) : undefined
  if (
    !parsed ||
    !votedAt ||
    Number.isNaN(votedAt.getTime()) ||
    !VOTE_FEED_ENTITY_TYPES.includes(parsed.type) ||
    !Number.isInteger(parsed.entityId) ||
    !Number.isInteger(parsed.voterId)
  ) {
    throw new InvalidVoteFeedCursorError()
  }

  return {
    votedAt,
    type: parsed.type,
    entityId: parsed.entityId,
    voterId: parsed.voterId,
  }
}

const toUserEntity = (user: UserInfo): UserEntity => ({
  id: user.id,
  username: user.username,
  gender: user.gender as unknown as UserGender,
  karma: user.karma,
  name: user.name,
  vote: user.vote,
})

const toPostEntity = (post: PostInfo): PostEntity => ({
  id: post.id,
  site: post.site,
  title: post.title,
  author: post.author,
  created: post.created.toISOString(),
  content: post.content,
  rating: post.rating,
  comments: post.comments,
  newComments: post.newComments,
  bookmark: post.bookmark,
  watch: post.watch,
  canEdit: post.canEdit,
  editFlag: post.editFlag,
  vote: post.vote,
  language: post.language,
})

const toCommentEntity = (comment: CommentInfoWithPostData): CommentEntity => ({
  id: comment.id,
  author: comment.author,
  content: comment.content,
  created: comment.created.toISOString(),
  deleted: comment.deleted,
  rating: comment.rating,
  parentComment: comment.parentComment,
  editFlag: comment.editFlag,
  post: comment.post,
  site: comment.site,
  canEdit: comment.canEdit,
  isNew: comment.isNew,
  vote: comment.vote,
  language: comment.language,
})

const toEventRef = (ref: VoteFeedReference): UserVoteFeedEventRef => ({
  type: ref.type,
  entityId: ref.entityId,
  postId: ref.postId,
  voterId: ref.voterId,
  targetUserId: ref.targetUserId,
  vote: ref.vote,
  votedAt: ref.votedAt.toISOString(),
})

export default class VoteFeedManager {
  private readonly voteFeedReadRepository: VoteFeedReadRepository
  private readonly postManager: PostManager
  private readonly userManager: UserManager
  private readonly logger: Logger

  constructor(
    voteFeedReadRepository: VoteFeedReadRepository,
    postManager: PostManager,
    userManager: UserManager,
    logger: Logger,
  ) {
    this.voteFeedReadRepository = voteFeedReadRepository
    this.postManager = postManager
    this.userManager = userManager
    this.logger = logger
  }

  async getVoteFeed(
    forUserId: number,
    direction: VoteFeedDirection,
    filter: string,
    cursor: string | undefined,
    perpage: number,
  ): Promise<UserVotesResponse> {
    const decodedCursor = cursor ? decodeVoteFeedCursor(cursor) : undefined
    const refs = await this.voteFeedReadRepository.getPageReferences(
      forUserId,
      direction,
      filter,
      decodedCursor,
      perpage + 1,
    )
    const hasMore = refs.length > perpage
    const pageRefs = hasMore ? refs.slice(0, perpage) : refs
    const nextCursor = hasMore && pageRefs.length ? encodeVoteFeedCursor(pageRefs[pageRefs.length - 1]) : undefined

    if (direction === 'received') {
      return this.hydrateReceived(forUserId, pageRefs, hasMore, nextCursor)
    }
    return this.hydrateMine(forUserId, pageRefs, hasMore, nextCursor)
  }

  private async hydrateMine(
    forUserId: number,
    refs: VoteFeedReference[],
    hasMore: boolean,
    nextCursor: string | undefined,
  ): Promise<UserVotesResponse> {
    const postIds = this.entityIds(refs, 'post')
    const commentIds = this.entityIds(refs, 'comment')
    const commentPostIds = [
      ...new Set(refs.flatMap((ref) => (ref.type === 'comment' && ref.postId ? [ref.postId] : []))),
    ]
    const [posts, comments, postTitles] = await Promise.all([
      this.postManager.getPostsByIds(postIds, forUserId),
      this.postManager.getCommentsByIds(commentIds, forUserId),
      this.postManager.getPostTitlesByIds(commentPostIds),
    ])
    const parentComments = await this.postManager.getParentCommentsForASetOfComments(comments, forUserId, 'html')

    const postsById = this.indexById(posts.map(toPostEntity))
    const commentsById = this.indexById(comments.map(toCommentEntity))
    const parentCommentsById = this.indexById(parentComments.map(toCommentEntity))
    for (const post of posts) {
      if (post.title) {
        postTitles[post.id] = post.title
      }
    }

    const users = await this.loadUsers(refs, [
      ...posts.map((post) => post.author),
      ...comments.map((comment) => comment.author),
      ...parentComments.map((comment) => comment.author),
    ])
    const events = this.filterExistingEvents(
      refs,
      (ref) => {
        if (ref.type === 'post') {
          return !!postsById[ref.entityId]
        }
        if (ref.type === 'comment') {
          return !!commentsById[ref.entityId]
        }
        return !!users[ref.entityId]
      },
      forUserId,
      'mine',
    )

    return {
      direction: 'mine',
      events,
      users,
      entities: {
        posts: postsById,
        comments: commentsById,
        parentComments: parentCommentsById,
        postTitles,
      },
      hasMore,
      nextCursor,
    }
  }

  private async hydrateReceived(
    forUserId: number,
    refs: VoteFeedReference[],
    hasMore: boolean,
    nextCursor: string | undefined,
  ): Promise<UserVotesResponse> {
    const [postRows, commentRows] = await Promise.all([
      this.voteFeedReadRepository.getReceivedPostSubjects(this.entityIds(refs, 'post')),
      this.voteFeedReadRepository.getReceivedCommentSubjects(this.entityIds(refs, 'comment')),
    ])
    const posts: Record<number, ReceivedPostSubject> = {}
    for (const row of postRows) {
      const title = row.title?.trim()
      const label =
        title ||
        stripHtml(row.html || '')
          .result.replace(/\s+/g, ' ')
          .trim()
      const id = Number(row.id)
      posts[id] = {
        id,
        site: row.site,
        label: label.slice(0, 72),
        rating: Number(row.rating),
      }
    }
    const comments: Record<number, ReceivedCommentSubject> = {}
    for (const row of commentRows) {
      const id = Number(row.id)
      const postTitle = row.postTitle?.trim()
      comments[id] = {
        id,
        postId: Number(row.postId),
        site: row.site,
        postTitle: postTitle || undefined,
        rating: Number(row.rating),
      }
    }

    const users = await this.loadUsers(refs)
    const events = this.filterExistingEvents(
      refs,
      (ref) => {
        if (ref.type === 'post') {
          return !!posts[ref.entityId]
        }
        if (ref.type === 'comment') {
          return !!comments[ref.entityId]
        }
        return !!users[ref.entityId]
      },
      forUserId,
      'received',
    )

    return {
      direction: 'received',
      events,
      users,
      subjects: { posts, comments },
      hasMore,
      nextCursor,
    }
  }

  private entityIds(refs: VoteFeedReference[], type: VoteFeedReference['type']): number[] {
    return [...new Set(refs.filter((ref) => ref.type === type).map((ref) => ref.entityId))]
  }

  private indexById<T extends { id: number }>(items: T[]): Record<number, T> {
    return items.reduce<Record<number, T>>((index, item) => {
      index[item.id] = item
      return index
    }, {})
  }

  private async loadUsers(refs: VoteFeedReference[], authorIds: number[] = []): Promise<Record<number, UserEntity>> {
    const ids = new Set<number>(authorIds)
    for (const ref of refs) {
      ids.add(ref.voterId)
      ids.add(ref.targetUserId)
      if (ref.type === 'user') {
        ids.add(ref.entityId)
      }
    }
    const users = await this.userManager.getByIds([...ids])
    return Object.values(users).reduce<Record<number, UserEntity>>((result, user) => {
      result[user.id] = toUserEntity(user)
      return result
    }, {})
  }

  private filterExistingEvents(
    refs: VoteFeedReference[],
    exists: (ref: VoteFeedReference) => boolean,
    forUserId: number,
    direction: VoteFeedDirection,
  ): UserVoteFeedEventRef[] {
    const events: UserVoteFeedEventRef[] = []
    for (const ref of refs) {
      if (exists(ref)) {
        events.push(toEventRef(ref))
      } else {
        this.logger.warn('Dropped vote feed event with missing entity', {
          forUserId,
          direction,
          type: ref.type,
          entityId: ref.entityId,
        })
      }
    }
    return events
  }
}
