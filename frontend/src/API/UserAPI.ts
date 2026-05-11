import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { SiteInfo } from '../Types/SiteInfo'
import { BarmaliniAccessResult, UserGender, UserInfo, UsernameSuggestResult, UserProfileInfo } from '../Types/UserInfo'
import APIBase from './APIBase'
import { CommentEntity, ContentFormat, PostEntity } from './PostAPI'
import PostAPIHelper from './PostAPIHelper'
import { VoteListItemEntity } from './VoteAPI'

export type UserProfileEntity = UserInfo & {
  registered: string
  active: boolean
}
type UseProfileRequest = {
  username: string
}
type UserProfileResponse = {
  profile: UserProfileEntity
  invitedBy: UserInfo
  invites: UserProfileInfo[]

  invitedReason?: string
  trialProgress?: number
  daysLeftOnTrial?: number
  trialApprovers?: VoteListItemEntity[]
  numberOfPosts: number
  numberOfComments: number
  numberOfInvitesAvailable?: number
  isBarmalini?: boolean
  publicKey: string
  hasOwnApps: boolean
  visitedDaysAgo: number
}
type UserProfilePostsRequest = {
  username: string
  filter?: string
  format?: ContentFormat
  page?: number
  perpage?: number
}
type UserProfilePostsResponse = {
  posts: PostEntity[]
  users: Record<number, UserInfo>
  total: number
  sites: Record<string, SiteInfo>
}
type UserProfilePostsResult = {
  posts: PostInfo[]
  total: number
}

type UserProfileCommentsRequest = {
  username: string
  format?: ContentFormat
  filter?: string
  page?: number
  perpage?: number
}
type UserProfileCommentsResponse = {
  comments: CommentEntity[]
  parentComments: Record<number, CommentEntity>
  users: Record<number, UserInfo>
  total: number
}
type UserProfileCommentsResult = {
  comments: CommentInfo[]
  parentComments?: Record<number, CommentInfo>
  total: number
}

export type UserVotesDirection = 'mine' | 'received'
export type UserVoteFeedGroupKind = 'entity' | 'voter' | 'target-author' | 'context-post' | 'single'

type UserVotesRequest = {
  direction: UserVotesDirection
  format?: ContentFormat
  filter?: string
  page?: number
  perpage?: number
}

type UserVoteFeedEventBaseEntity = {
  vote: number
  votedAt: string
  voterId: number
  targetUserId: number
}

type UserVoteFeedPostEventEntity = UserVoteFeedEventBaseEntity & {
  type: 'post'
  post: PostEntity
}

type UserVoteFeedCommentEventEntity = UserVoteFeedEventBaseEntity & {
  type: 'comment'
  comment: CommentEntity
  parentComment?: CommentEntity
}

type UserVoteFeedUserEventEntity = UserVoteFeedEventBaseEntity & {
  type: 'user'
  user: UserInfo
}

type UserVoteFeedEventEntity =
  | UserVoteFeedPostEventEntity
  | UserVoteFeedCommentEventEntity
  | UserVoteFeedUserEventEntity

type UserVoteFeedGroupEntity = {
  kind: UserVoteFeedGroupKind
  latestAt: string
  events: UserVoteFeedEventEntity[]
  entityType?: 'post' | 'comment' | 'user'
  entityId?: number
  voterId?: number
  targetUserId?: number
  contextPostId?: number
}

type UserVotesResponse = {
  total: number
  groups: UserVoteFeedGroupEntity[]
  users: Record<number, UserInfo>
}

type UserVoteFeedEventBase = {
  vote: number
  votedAt: Date
  voterId: number
  targetUserId: number
}

export type UserVoteFeedPostEvent = UserVoteFeedEventBase & {
  type: 'post'
  post: PostInfo
}

export type UserVoteFeedCommentEvent = UserVoteFeedEventBase & {
  type: 'comment'
  comment: CommentInfo
  parentComment?: CommentInfo
}

export type UserVoteFeedUserEvent = UserVoteFeedEventBase & {
  type: 'user'
  user: UserInfo
}

export type UserVoteFeedEvent = UserVoteFeedPostEvent | UserVoteFeedCommentEvent | UserVoteFeedUserEvent

export type UserVoteFeedGroup = {
  kind: UserVoteFeedGroupKind
  latestAt: Date
  events: UserVoteFeedEvent[]
  entityType?: 'post' | 'comment' | 'user'
  entityId?: number
  voterId?: number
  targetUserId?: number
  contextPostId?: number
}

export type UserVotesResult = {
  total: number
  groups: UserVoteFeedGroup[]
  users: Record<number, UserInfo>
}

export type TrialProgressDebugInfo = {
  effectiveKarmaPart: number
  daysOnSitePart: number
  singleVotesPart?: number
  doubleVotesPart?: number
}

export type UserKarmaResponse = {
  effectiveKarma: number
  effectiveKarmaUserRating: number
  effectiveKarmaContentRating: number
  senatePenalty: number
  activeKarmaVotes: Record<string, number>

  postRatingBySubsite: Record<string, number>
  commentRatingBySubsite: Record<string, number>
  trialProgress: TrialProgressDebugInfo
  totalNormalizedContentRating: number
  contentVotersNum: number
}

/* see UserRestrictions */
export type UserRestrictionsResponse = {
  effectiveKarma: number
  senatePenalty: number

  postSlowModeWaitSec: number
  postSlowModeWaitSecRemain: number

  commentSlowModeWaitSec: number
  commentSlowModeWaitSecRemain: number

  restrictedToPostId: number | true | false
  canVote: boolean
  canVoteKarma: boolean
  canInvite: boolean
  canEditOwnContent: boolean
  canCreateSubsites: boolean
}

export default class UserAPI {
  api: APIBase
  postAPIHelper: PostAPIHelper

  constructor(api: APIBase, postAPIHelper: PostAPIHelper) {
    this.api = api
    this.postAPIHelper = postAPIHelper
  }

  userProfile(username: string): Promise<UserProfileResponse> {
    return this.api.request<UseProfileRequest, UserProfileResponse>('/user/profile', { username })
  }

  async userPosts(
    username: string,
    filter: string | undefined,
    page: number,
    perpage: number,
  ): Promise<UserProfilePostsResult> {
    const result = await this.api.request<UserProfilePostsRequest, UserProfilePostsResponse>('/user/posts', {
      username,
      format: 'html',
      page,
      perpage,
      filter,
    })
    return {
      posts: this.postAPIHelper.fixPosts(result.posts, result.users),
      total: result.total,
    }
  }

  async userComments(
    username: string,
    filter: string,
    page: number,
    perpage: number,
  ): Promise<UserProfileCommentsResult> {
    const result = await this.api.request<UserProfileCommentsRequest, UserProfileCommentsResponse>('/user/comments', {
      username,
      format: 'html',
      page,
      perpage,
      filter,
    })
    return {
      comments: this.postAPIHelper.fixComments(result.comments, result.users),
      parentComments: this.postAPIHelper.fixCommentsRecords(result.parentComments, result.users),
      total: result.total,
    }
  }

  async userKarma(username: string): Promise<UserKarmaResponse> {
    return await this.api.request<{ username: string }, UserKarmaResponse>('/user/karma', { username })
  }

  async userVotes(
    direction: UserVotesDirection,
    filter: string,
    page: number,
    perpage: number,
  ): Promise<UserVotesResult> {
    const result = await this.api.request<UserVotesRequest, UserVotesResponse>('/user/votes', {
      direction,
      format: 'html',
      page,
      perpage,
      filter,
    })

    return {
      total: result.total,
      users: result.users,
      groups: result.groups.map((group) => ({
        ...group,
        latestAt: this.api.fixDate(new Date(group.latestAt)),
        events: group.events.map((event) => this.fixVoteFeedEvent(event, result.users)),
      })),
    }
  }

  private fixVoteFeedEvent(event: UserVoteFeedEventEntity, users: Record<number, UserInfo>): UserVoteFeedEvent {
    const base = {
      vote: event.vote,
      votedAt: this.api.fixDate(new Date(event.votedAt)),
      voterId: event.voterId,
      targetUserId: event.targetUserId,
    }

    if (event.type === 'post') {
      return {
        ...base,
        type: 'post',
        post: this.postAPIHelper.fixPosts([event.post], users)[0],
      }
    }

    if (event.type === 'comment') {
      return {
        ...base,
        type: 'comment',
        comment: this.postAPIHelper.fixComments([event.comment], users)[0],
        parentComment: event.parentComment
          ? this.postAPIHelper.fixComments([event.parentComment], users)[0]
          : undefined,
      }
    }

    return {
      ...base,
      type: 'user',
      user: event.user,
    }
  }

  userRestrictions(username: string): Promise<UserRestrictionsResponse> {
    return this.api.request<{ username: string }, UserRestrictionsResponse>('/user/restrictions', { username })
  }

  async saveBio(bio: string): Promise<{ bio: string }> {
    return this.api.request<{ bio: string }, { bio: string }>('/user/savebio', { bio })
  }

  async saveName(name: string): Promise<{ name: string }> {
    return this.api.request<{ name: string }, { name: string }>('/user/savename', { name })
  }

  async saveGender(gender: UserGender): Promise<{ gender: UserGender }> {
    return this.api.request<{ gender: UserGender }, { gender: UserGender }>('/user/savegender', { gender })
  }

  async savePublicKey(publicKey: string): Promise<{ publicKey: string }> {
    return this.api.request<{ publicKey: string }, { publicKey: string }>('/user/save-public-key', { publicKey })
  }

  async getBarmaliniAccess(): Promise<BarmaliniAccessResult> {
    return this.api.request<Record<string, unknown>, BarmaliniAccessResult>('/user/barmalini', {})
  }

  async getUsernameSuggestions(start: string): Promise<UsernameSuggestResult> {
    return this.api.request<{ start: string }, UsernameSuggestResult>('/user/suggest-username', { start })
  }

  async anonymizeAccount(): Promise<Record<string, never>> {
    return this.api.request<Record<string, never>, Record<string, never>>('/user/anonymize-account', {})
  }
}
