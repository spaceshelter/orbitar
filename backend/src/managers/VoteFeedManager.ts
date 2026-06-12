import { Logger } from 'winston'

import { CommentEntity } from '../api/types/entities/CommentEntity'
import { ContentFormat } from '../api/types/entities/common'
import { PostEntity } from '../api/types/entities/PostEntity'
import { UserEntity } from '../api/types/entities/UserEntity'
import { UserVoteFeedEvent } from '../api/types/requests/UserVotes'
import { Enricher } from '../api/utils/Enricher'
import VoteRepository, { VoteFeedCursor, VoteFeedDirection, VoteFeedReference } from '../db/repositories/VoteRepository'
import PostManager from './PostManager'
import UserManager from './UserManager'

export class InvalidVoteFeedCursorError extends Error {
  constructor() {
    super('Invalid vote feed cursor')
  }
}

export type VoteFeedResult = {
  events: UserVoteFeedEvent[]
  users: Record<number, UserEntity>
  hasMore: boolean
  nextCursor?: string
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

  if (
    !parsed ||
    typeof parsed.votedAt !== 'number' ||
    !Number.isFinite(parsed.votedAt) ||
    !VOTE_FEED_ENTITY_TYPES.includes(parsed.type) ||
    !Number.isInteger(parsed.entityId) ||
    !Number.isInteger(parsed.voterId)
  ) {
    throw new InvalidVoteFeedCursorError()
  }

  return {
    votedAt: new Date(parsed.votedAt),
    type: parsed.type,
    entityId: parsed.entityId,
    voterId: parsed.voterId,
  }
}

export default class VoteFeedManager {
  private readonly voteRepository: VoteRepository
  private readonly postManager: PostManager
  private readonly userManager: UserManager
  private readonly enricher: Enricher
  private readonly logger: Logger

  constructor(
    voteRepository: VoteRepository,
    postManager: PostManager,
    userManager: UserManager,
    enricher: Enricher,
    logger: Logger,
  ) {
    this.voteRepository = voteRepository
    this.postManager = postManager
    this.userManager = userManager
    this.enricher = enricher
    this.logger = logger
  }

  async getVoteFeed(
    forUserId: number,
    direction: VoteFeedDirection,
    filter: string,
    cursor: string | undefined,
    perpage: number,
    format: ContentFormat,
  ): Promise<VoteFeedResult> {
    const decodedCursor = cursor ? decodeVoteFeedCursor(cursor) : undefined
    const refs = await this.voteRepository.getVoteFeedEvents(forUserId, direction, filter, decodedCursor, perpage + 1)
    const hasMore = refs.length > perpage
    const pageRefs = hasMore ? refs.slice(0, perpage) : refs

    const postIds = [...new Set(pageRefs.filter((ref) => ref.type === 'post').map((ref) => ref.entityId))]
    const commentIds = [...new Set(pageRefs.filter((ref) => ref.type === 'comment').map((ref) => ref.entityId))]
    const profileUserIds = [...new Set(pageRefs.filter((ref) => ref.type === 'user').map((ref) => ref.entityId))]
    const voterIds = [...new Set(pageRefs.map((ref) => ref.voterId))]
    const commentPostIds = [
      ...new Set(
        pageRefs
          .filter((ref) => ref.type === 'comment' && ref.postId)
          .map((ref) => ref.postId as number)
          .filter((postId) => !postIds.includes(postId)),
      ),
    ]

    const [rawPosts, rawComments, commentPostTitles] = await Promise.all([
      this.postManager.getPostsByIds(postIds, forUserId, format),
      this.postManager.getCommentsByIds(commentIds, forUserId, format),
      this.postManager.getPostTitlesByIds(commentPostIds),
    ])

    const { posts, users: postUsers } = await this.enricher.enrichRawPosts(rawPosts)
    const rawParentComments = await this.postManager.getParentCommentsForASetOfComments(rawComments, forUserId, format)
    const { allComments, users } = await this.enricher.enrichRawComments(rawComments, postUsers, format, (_) => false)
    const { allComments: parentComments } = await this.enricher.enrichRawComments(
      rawParentComments,
      users,
      format,
      (_) => false,
    )

    const postsById: Record<number, PostEntity> = {}
    const postTitlesById: Record<number, string> = { ...commentPostTitles }
    posts.forEach((post) => {
      postsById[post.id] = post
      if (post.title) {
        postTitlesById[post.id] = post.title
      }
    })

    const commentsById: Record<number, CommentEntity> = {}
    allComments.forEach((comment) => {
      commentsById[comment.id] = comment
    })

    const parentCommentsById: Record<number, CommentEntity> = {}
    parentComments.forEach((comment) => {
      parentCommentsById[comment.id] = comment
    })

    const voteUsers = await this.userManager.getByIds(
      [...profileUserIds, ...voterIds].filter((voteUserId) => !users[voteUserId]),
    )
    Object.assign(users, voteUsers)

    const events: UserVoteFeedEvent[] = []
    for (const ref of pageRefs) {
      const event = this.buildEvent(ref, postsById, postTitlesById, commentsById, parentCommentsById, users)
      if (event) {
        events.push(event)
      } else {
        this.logger.warn('Dropped vote feed event with missing entity', {
          forUserId,
          direction,
          type: ref.type,
          entityId: ref.entityId,
        })
      }
    }

    return {
      events,
      users,
      hasMore,
      nextCursor: hasMore && pageRefs.length ? encodeVoteFeedCursor(pageRefs[pageRefs.length - 1]) : undefined,
    }
  }

  private buildEvent(
    ref: VoteFeedReference,
    postsById: Record<number, PostEntity>,
    postTitlesById: Record<number, string>,
    commentsById: Record<number, CommentEntity>,
    parentCommentsById: Record<number, CommentEntity>,
    users: Record<number, UserEntity>,
  ): UserVoteFeedEvent | undefined {
    const base = {
      vote: ref.vote,
      votedAt: ref.votedAt.toISOString(),
      voterId: ref.voterId,
      targetUserId: ref.targetUserId,
    }

    if (ref.type === 'post' && postsById[ref.entityId]) {
      return {
        ...base,
        type: 'post',
        post: postsById[ref.entityId],
      }
    }

    if (ref.type === 'comment' && commentsById[ref.entityId]) {
      const comment = commentsById[ref.entityId]
      return {
        ...base,
        type: 'comment',
        comment,
        parentComment: comment.parentComment ? parentCommentsById[comment.parentComment] : undefined,
        postTitle: (ref.postId && postTitlesById[ref.postId]) || undefined,
      }
    }

    if (ref.type === 'user' && users[ref.entityId]) {
      return {
        ...base,
        type: 'user',
        user: users[ref.entityId],
      }
    }

    return undefined
  }
}
