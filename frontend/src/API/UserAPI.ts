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

type UserVotesRequest = {
  direction: UserVotesDirection
  filter?: string
  cursor?: string
  perpage?: number
}

type UserVoteFeedEventEntity<VotedAt> = {
  type: 'post' | 'comment' | 'user'
  entityId: number
  postId?: number
  vote: number
  votedAt: VotedAt
  voterId: number
  targetUserId: number
}

type UserVoteFeedEventRefEntity = UserVoteFeedEventEntity<string>

export type ReceivedPostSubject = {
  id: number
  site: string
  label: string
  rating: number
}

export type ReceivedCommentSubject = {
  id: number
  postId: number
  site: string
  postTitle?: string
  rating: number
}

type UserVotesResponseBase = {
  events: UserVoteFeedEventRefEntity[]
  users: Record<number, UserInfo>
  hasMore: boolean
  nextCursor?: string
}

type UserVotesMineResponse = UserVotesResponseBase & {
  direction: 'mine'
  entities: {
    posts: Record<number, PostEntity>
    comments: Record<number, CommentEntity>
    parentComments: Record<number, CommentEntity>
    postTitles: Record<number, string>
  }
}

type UserVotesReceivedResponse = UserVotesResponseBase & {
  direction: 'received'
  subjects: {
    posts: Record<number, ReceivedPostSubject>
    comments: Record<number, ReceivedCommentSubject>
  }
}

type UserVotesResponse = UserVotesMineResponse | UserVotesReceivedResponse

export type UserVoteFeedEvent = UserVoteFeedEventEntity<Date>

type UserVotesResultBase = {
  events: UserVoteFeedEvent[]
  users: Record<number, UserInfo>
  hasMore: boolean
  nextCursor?: string
}

export type UserVotesMineResult = UserVotesResultBase & {
  direction: 'mine'
  entities: {
    posts: Record<number, PostInfo>
    comments: Record<number, CommentInfo>
    parentComments: Record<number, CommentInfo>
    postTitles: Record<number, string>
  }
}

export type UserVotesReceivedResult = UserVotesResultBase & {
  direction: 'received'
  subjects: {
    posts: Record<number, ReceivedPostSubject>
    comments: Record<number, ReceivedCommentSubject>
  }
}

export type UserVotesResult = UserVotesMineResult | UserVotesReceivedResult

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
    cursor: string | undefined,
    perpage: number,
    signal?: AbortSignal,
  ): Promise<UserVotesResult> {
    const result = await this.api.request<UserVotesRequest, UserVotesResponse>(
      '/user/votes',
      {
        direction,
        cursor,
        perpage,
        filter,
      },
      undefined,
      signal,
    )

    const base = {
      events: result.events.map((event) => ({
        ...event,
        votedAt: this.api.fixDate(new Date(event.votedAt)),
      })),
      users: result.users,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    }

    if (result.direction === 'received') {
      return {
        ...base,
        direction: 'received',
        subjects: result.subjects,
      }
    }

    const posts: Record<number, PostInfo> = {}
    this.postAPIHelper.fixPosts(Object.values(result.entities.posts), result.users).forEach((post) => {
      posts[post.id] = post
    })

    return {
      ...base,
      direction: 'mine',
      entities: {
        posts,
        comments: this.postAPIHelper.fixCommentsRecords(result.entities.comments, result.users),
        parentComments: this.postAPIHelper.fixCommentsRecords(result.entities.parentComments, result.users),
        postTitles: result.entities.postTitles,
      },
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
