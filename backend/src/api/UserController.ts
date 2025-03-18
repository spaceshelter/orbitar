import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import InviteManager from '../managers/InviteManager'
import MarkerManager from '../managers/MarkerManager'
import OAuth2Manager from '../managers/OAuth2Manager'
import PostManager from '../managers/PostManager'
import { MarkerTargetType } from '../managers/types/MarkerInfo'
import { UserGender, UserRatingBySubsite } from '../managers/types/UserInfo'
import UserManager from '../managers/UserManager'
import VoteManager from '../managers/VoteManager'
import { APIRequest, APIResponse, joiFormat, joiUsername, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { UserProfileEntity } from './types/entities/UserEntity'
import { UserCommentsRequest, UserCommentsResponse } from './types/requests/UserComments'
import { UserMarkedContentRequest, UserMarkedContentResponse } from './types/requests/UserMarkedContent'
import { SuggestUsernameRequest, SuggestUsernameResponse } from './types/requests/UsernameSuggest'
import { UserPostsRequest, UserPostsResponse } from './types/requests/UserPosts'
import {
  BarmaliniPasswordRequest,
  BarmaliniPasswordResponse,
  UserKarmaResponse,
  UserProfileRequest,
  UserProfileResponse,
  UserRestrictionsResponse,
  UserSaveBioRequest,
  UserSaveBioResponse,
  UserSaveGenderRequest,
  UserSaveGenderResponse,
  UserSaveNameRequest,
  UserSaveNameResponse,
  UserSavePublicKeyRequest,
  UserSavePublicKeyResponse,
} from './types/requests/UserProfile'
import { Enricher } from './utils/Enricher'
// constant variables
import { ERROR_CODES } from './utils/error-codes'

export default class UserController {
  public readonly router = Router()
  private readonly userManager: UserManager
  private readonly postManager: PostManager
  private readonly voteManager: VoteManager
  private readonly inviteManager: InviteManager
  private readonly markerManager: MarkerManager
  private readonly logger: Logger
  private readonly enricher: Enricher
  private readonly oauthManager: OAuth2Manager

  constructor(
    enricher: Enricher,
    userManager: UserManager,
    postManager: PostManager,
    voteManager: VoteManager,
    inviteManager: InviteManager,
    markerManager: MarkerManager,
    oauth: OAuth2MiddlewareGenerator,
    oauthManager: OAuth2Manager,
    logger: Logger,
  ) {
    this.enricher = enricher
    this.userManager = userManager
    this.postManager = postManager
    this.voteManager = voteManager
    this.inviteManager = inviteManager
    this.markerManager = markerManager
    this.oauthManager = oauthManager
    this.logger = logger

    const profileSchema = Joi.object<UserProfileRequest>({
      username: joiUsername.required(),
    })
    const postsOrCommentsSchema = Joi.object<UserPostsRequest>({
      username: joiUsername.required(),
      format: joiFormat,
      filter: Joi.string().max(120).allow(null, ''),
      page: Joi.number().default(1),
      perpage: Joi.number().min(1).max(50).default(10),
    })

    const userCommentsAndPostsLimiter = rateLimit({
      windowMs: 8000,
      max: 10,
    })

    const bioSchema = Joi.object<UserSaveBioRequest>({
      bio: Joi.string()
        .required()
        .max(1024 * 4),
    })

    const nameSchema = Joi.object<UserSaveNameRequest>({
      name: Joi.string().required().max(100),
    })

    const genderSchema = Joi.object<UserSaveGenderRequest>({
      gender: Joi.number().required().allow(UserGender.fluid, UserGender.he, UserGender.she),
    })

    const publicKeySchema = Joi.object<UserSavePublicKeyRequest>({
      publicKey: Joi.string().max(128).allow(''),
    })

    const settingsSaveLimiter = rateLimit({
      windowMs: 1000 * 60,
      max: 20,
      skipSuccessfulRequests: false,
      standardHeaders: false,
      legacyHeaders: false,
      keyGenerator: (req) => String(req.session.data?.userId),
    })

    const suggestUsernameLimiter = rateLimit({
      windowMs: 1000 * 60 * 5,
      max: 100,
      keyGenerator: (req) => String(req.session.data?.userId),
    })

    const markedContentSchema = Joi.object<UserMarkedContentRequest>({
      username: joiUsername.required(),
      contentType: Joi.string().valid('posts', 'comments', 'users').required(),
      markerTypes: Joi.array().items(Joi.string().valid('star', 'note', 'bookmark')),
      filter: Joi.string().max(120).allow(null, ''),
      format: joiFormat,
      page: Joi.number().default(1),
      perpage: Joi.number().min(1).max(50).default(20),
    })

    this.router.post('/user/profile', oauth('читать профиль пользователя'), validate(profileSchema), (req, res) =>
      this.profile(req, res),
    )
    this.router.post(
      '/user/posts',
      userCommentsAndPostsLimiter,
      oauth('читать посты пользователя'),
      validate(postsOrCommentsSchema),
      (req, res) => this.posts(req, res),
    )
    this.router.post(
      '/user/comments',
      userCommentsAndPostsLimiter,
      validate(postsOrCommentsSchema),
      oauth('читать комментарии пользователя'),
      (req, res) => this.comments(req, res),
    )
    this.router.post('/user/karma', validate(profileSchema), oauth('читать инфо о карме пользователя'), (req, res) =>
      this.karma(req, res),
    )
    this.router.post('/user/clearCache', validate(profileSchema), (req, res) => this.clearCache(req, res))
    this.router.post(
      '/user/restrictions',
      validate(profileSchema),
      oauth('читать ограничения пользователя'),
      (req, res) => this.restrictions(req, res),
    )
    this.router.post(
      '/user/savebio',
      settingsSaveLimiter,
      validate(bioSchema),
      oauth('менять био в профиле'),
      (req, res) => this.saveBio(req, res),
    )
    this.router.post(
      '/user/savename',
      settingsSaveLimiter,
      validate(nameSchema),
      oauth('менять имя в профиле'),
      (req, res) => this.saveName(req, res),
    )
    this.router.post(
      '/user/savegender',
      settingsSaveLimiter,
      validate(genderSchema),
      oauth('менять пол в профиле'),
      (req, res) => this.saveGender(req, res),
    )
    this.router.post('/user/barmalini', settingsSaveLimiter, (req, res) => this.barmaliniPassword(req, res))
    this.router.post(
      '/user/suggest-username',
      suggestUsernameLimiter,
      oauth('искать юзернеймы по префиксу'),
      (req, res) => this.suggestUsername(req, res),
    )
    this.router.post(
      '/user/save-public-key',
      settingsSaveLimiter,
      oauth('менять публичный ключ'),
      validate(publicKeySchema),
      (req, res) => this.savePublicKey(req, res),
    )
    this.router.post(
      '/user/marked-content',
      userCommentsAndPostsLimiter,
      validate(markedContentSchema),
      oauth('читать избранное пользователя'),
      (req, res) => this.markedContent(req, res),
    )
  }

  async profile(request: APIRequest<UserProfileRequest>, response: APIResponse<UserProfileResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { username } = request.body

    try {
      const profileInfo = await this.userManager.getByUsernameWithVote(username, userId)

      if (!profileInfo) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      if (await this.userIsRestrictedToOwnContent(userId, profileInfo.id)) {
        return response.error(ERROR_CODES.NO_PERMISSION, 'No permissions to view this profile', 403)
      }

      const invites = await this.userManager.getInvites(profileInfo.id)
      const invitedBy = await this.userManager.getInvitedBy(profileInfo.id)
      const active = await this.userManager.isUserActive(profileInfo.id)
      const publicKey = await this.userManager.getPublicKey(profileInfo.id)
      const trialApprovers = await this.userManager.getTrialApprovers(profileInfo.id)
      const invitedReason = await this.inviteManager.getInviteReason(profileInfo.id)
      const trialProgress = await this.userManager.tryEndTrial(profileInfo.id, false)
      const numberOfPosts = (await this.postManager.getPostsByUserTotal(profileInfo.id, '')) || 0
      const numberOfComments = (await this.postManager.getUserCommentsTotal(profileInfo.id, '')) || 0
      const visitedDaysAgo = await this.userManager.getUserVisitedDaysAgo(profileInfo.id)
      const hasOwnApps = await this.oauthManager.hasOwnApps(profileInfo.id)

      // if viewing own profile, get available invites number
      let numberOfInvitesAvailable = 0
      if (profileInfo.id === userId) {
        numberOfInvitesAvailable = (await this.inviteManager.getInvitesAvailability(profileInfo.id)).invitesLeft
      }

      // FIXME: converter needed
      const profile: UserProfileEntity = {
        ...profileInfo,
        active,
      } as unknown as UserProfileEntity
      profile.registered = profileInfo.registered.toISOString()

      const enrichedInvites: UserProfileEntity[] = []
      for (const u of invites) {
        const active = await this.userManager.isUserActive(u.id)
        enrichedInvites.push({
          ...u,
          active,
          registered: u.registered.toISOString(),
        })
      }

      // Get marker counts for the user
      const markerCounts = await this.markerManager.getCounters(MarkerTargetType.USER, profileInfo.id)

      // Get distinct target counts for all bookmarks (posts, comments, users combined)
      const markedItemsCount = await this.markerManager.countDistinctTargetsByCreator(profileInfo.id, 'all')

      return response.success({
        profile: profile,
        invitedBy: invitedBy,
        invites: enrichedInvites,
        trialApprovers: trialApprovers.length && trialApprovers,
        invitedReason,
        trialProgress,
        numberOfPosts,
        numberOfComments,
        numberOfInvitesAvailable,
        isBarmalini: this.userManager.isBarmaliniUser(profileInfo.id),
        publicKey,
        visitedDaysAgo,
        hasOwnApps,
        markedItemsCount,
        tokenCounts: {
          stars: markerCounts.star_count,
          notes: markerCounts.note_count,
          bookmarks: markerCounts.bookmark_count,
        },
      })
    } catch (error) {
      this.logger.error('Could not get user profile', { username })
      this.logger.error(error)
      return response.error('error', 'Unknown error', 500)
    }
  }

  async userIsRestrictedToOwnContent(userId: number, profileId: number) {
    const userRestrictions = await this.userManager.getUserRestrictions(userId)
    return userRestrictions.restrictedToPostId !== false && userId !== profileId
  }

  async posts(request: APIRequest<UserPostsRequest>, response: APIResponse<UserPostsResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { username, format, page, perpage, filter } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      if (await this.userIsRestrictedToOwnContent(userId, profile.id)) {
        return response.error(ERROR_CODES.NO_PERMISSION, "You are not allowed to view this user's posts", 403)
      }

      const total = await this.postManager.getPostsByUserTotal(profile.id, filter)
      const rawPosts = await this.postManager.getPostsByUser(
        profile.id,
        userId,
        filter,
        page || 1,
        perpage || 20,
        format,
      )
      const { posts, users } = await this.enricher.enrichRawPosts(rawPosts)

      response.success({
        posts,
        total,
        users,
      })
    } catch (error) {
      this.logger.error('Could not get user posts', { username, error })
      return response.error('error', `Could not get posts for user ${username}`, 500)
    }
  }

  async comments(request: APIRequest<UserCommentsRequest>, response: APIResponse<UserCommentsResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { username, format, page, perpage, filter } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      if (await this.userIsRestrictedToOwnContent(userId, profile.id)) {
        return response.error(ERROR_CODES.NO_PERMISSION, "You are not allowed to view this user's comments", 403)
      }

      const total = await this.postManager.getUserCommentsTotal(profile.id, filter)
      const rawComments = await this.postManager.getUserComments(
        profile.id,
        userId,
        filter,
        page || 1,
        perpage || 20,
        format,
      )
      const rawParentComments = await this.postManager.getParentCommentsForASetOfComments(rawComments, userId, format)
      const { allComments, users } = await this.enricher.enrichRawComments(rawComments)
      const { allComments: parentCommentsList } = await this.enricher.enrichRawComments(rawParentComments, users)

      const parentComments = parentCommentsList.reduce((acc, comment) => {
        acc[comment.id] = comment
        return acc
      }, {})

      response.success({
        comments: allComments,
        total,
        users,
        parentComments,
      })
    } catch (error) {
      this.logger.error('Could not get user comments', { username, error })
      this.logger.error(error)
      return response.error('error', `Could not get comments for user ${username}`, 500)
    }
  }

  async karma(request: APIRequest<UserProfileRequest>, response: APIResponse<UserKarmaResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const { username } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      if (await this.userIsRestrictedToOwnContent(request.session.data.userId, profile.id)) {
        return response.error(ERROR_CODES.NO_PERMISSION, "You are not allowed to view this user's karma", 403)
      }

      const effectiveKarmaDebug = await this.userManager.getUserEffectiveKarma(profile.id)
      const restrictions = await this.userManager.getUserRestrictions(profile.id)
      const { rating: totalNormalizedContentRating, voters: contentVotersNum } =
        await this.userManager.getNormalizedUserContentRating(profile.id)
      const ratingBySubsite: UserRatingBySubsite = await this.userManager.getUserRatingBySubsite(profile.id)
      const activeKarmaVotes = await this.userManager.getActiveKarmaVotes(profile.id)
      const trialProgress = await this.userManager.getTrialProgressRaw(profile.id)

      return response.success({
        effectiveKarma: effectiveKarmaDebug.effectiveKarma,
        effectiveKarmaUserRating: effectiveKarmaDebug.userRating,
        effectiveKarmaContentRating: effectiveKarmaDebug.contentRating,
        senatePenalty: restrictions.senatePenalty,
        activeKarmaVotes,
        postRatingBySubsite: ratingBySubsite.postRatingBySubsite,
        commentRatingBySubsite: ratingBySubsite.commentRatingBySubsite,
        trialProgress,
        totalNormalizedContentRating,
        contentVotersNum,
      })
    } catch (error) {
      this.logger.error('Could not get user karma', { username, error })
      return response.error('error', `Could not get karma for user ${username}`, 500)
    }
  }

  async restrictions(request: APIRequest<UserProfileRequest>, response: APIResponse<UserRestrictionsResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const { username } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      const restrictions = await this.userManager.getUserRestrictions(profile.id)

      return response.success({
        ...restrictions,
      })
    } catch (error) {
      this.logger.error('Could not get user restrictions', { username, error })
      return response.error('error', `Could not get restrictions for user ${username}`, 500)
    }
  }

  async clearCache(request: APIRequest<UserProfileRequest>, response: APIResponse<void>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { username } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      this.userManager.clearCache(profile.id)
      this.userManager.clearUserRestrictionsCache(profile.id)
    } catch (error) {
      this.logger.error('Something went wrong', { username, error })
      return response.error('error', `Could not get restrictions for user ${username}`, 500)
    }
  }

  async saveGender(request: APIRequest<UserSaveGenderRequest>, response: APIResponse<UserSaveGenderResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { gender } = request.body
    try {
      await this.userManager.saveGender(gender, request.session.data.userId)
      this.userManager.clearCache(request.session.data.userId)
      return response.success({ gender })
    } catch (error) {
      this.logger.error('Could not update user gender', { error })
      return response.error('error', `Could not update gender`, 500)
    }
  }

  async saveBio(request: APIRequest<UserSaveBioRequest>, response: APIResponse<UserSaveBioResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { bio } = request.body
    try {
      const newBioPreview = await this.userManager.saveBio(bio, request.session.data.userId)
      this.userManager.clearCache(request.session.data.userId)
      return response.success({ bio: newBioPreview })
    } catch (error) {
      this.logger.error('Could not update user bio', { error })
      return response.error('error', `Could not update bio`, 500)
    }
  }

  async saveName(request: APIRequest<UserSaveNameRequest>, response: APIResponse<UserSaveNameResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { name } = request.body
    try {
      const ok = await this.userManager.saveName(name, request.session.data.userId)
      if (!ok) {
        return response.error('error', `Could not save name to database`)
      }
      this.userManager.clearCache(request.session.data.userId)
      return response.success({ name: name })
    } catch (error) {
      this.logger.error('Could not update user name', { error })
      return response.error('error', `Could not update name`, 500)
    }
  }

  async barmaliniPassword(
    request: APIRequest<BarmaliniPasswordRequest>,
    response: APIResponse<BarmaliniPasswordResponse>,
  ) {
    if (!this.userManager.barmaliniUserConfigured()) {
      return response.error('error', `Barmalini is not configured`, 500)
    }

    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const userId = request.session.data.userId
    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (this.userManager.isBarmaliniUser(userId) || !restrictions.canVoteKarma) {
        return response.error('error', `Not enough permissions`, 403)
      }

      const barmaliniUser = await this.userManager.getBarmaliniUser()

      return response.success({
        login: barmaliniUser.username,
        password: this.userManager.createBarmaliniPassword(),
      })
    } catch (error) {
      this.logger.error('Could not create barmalini password', { error })
      this.logger.error(error)
      return response.error('error', `Could not create barmalini password`, 500)
    }
  }

  suggestUsername(request: APIRequest<SuggestUsernameRequest>, response: APIResponse<SuggestUsernameResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }
    const { start } = request.body
    try {
      return response.success({ usernames: this.userManager.getUsernameSuggestions(start) })
    } catch (error) {
      this.logger.error('Could not get usernames suggestions', { error })
      return response.error('error', `Could not get usernames suggestions`, 500)
    }
  }

  private savePublicKey(req: APIRequest<UserSavePublicKeyRequest>, res: APIResponse<UserSavePublicKeyResponse>) {
    if (!req.session.data.userId) {
      return res.authRequired()
    }
    const { publicKey } = req.body
    try {
      this.userManager.savePublicKey(publicKey, req.session.data.userId)
      return res.success({ publicKey })
    } catch (error) {
      this.logger.error('Could not update user public key', { error })
      return res.error('error', `Could not update public key`, 500)
    }
  }

  /**
   * API endpoint to fetch content that has been marked by a user
   * Supports different content types (posts, comments, users) and marker types (star, note, bookmark)
   * Handles permission checks, pagination, and proper type conversions for API responses
   */
  async markedContent(request: APIRequest<UserMarkedContentRequest>, response: APIResponse<UserMarkedContentResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { username, contentType, markerTypes, filter, format, page = 1, perpage = 20 } = request.body

    try {
      const profile = await this.userManager.getByUsername(username)

      if (!profile) {
        return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404)
      }

      if (await this.userIsRestrictedToOwnContent(userId, profile.id)) {
        return response.error(ERROR_CODES.NO_PERMISSION, "You are not allowed to view this user's marked content", 403)
      }

      // Prepare the response with correct types
      const responseData: UserMarkedContentResponse = { users: {}, total: 0 }

      // Process each content type using specialized methods
      switch (contentType) {
        case 'posts': {
          // Get posts using specialized method
          const { posts, total } = await this.markerManager.getMarkedPosts(
            profile.id,
            userId,
            markerTypes,
            filter,
            format,
            page,
            perpage,
          )
          const { posts: enrichedPosts, users: enrichedUsers } = await this.enricher.enrichRawPosts(posts)
          responseData.posts = enrichedPosts
          responseData.users = enrichedUsers
          responseData.total = total
          break
        }

        case 'comments': {
          // Get comments using specialized method
          const { comments, users, parentComments, total } = await this.markerManager.getMarkedComments(
            profile.id,
            userId,
            markerTypes,
            filter,
            format,
            page,
            perpage,
          )

          // Enrich comments for API response
          const { allComments } = await this.enricher.enrichRawComments(comments, users)

          // Enrich parent comments
          const { allComments: parentCommentsList } = await this.enricher.enrichRawComments(
            Object.values(parentComments),
            users,
          )

          // Convert parent comments array to map indexed by comment ID
          const parentCommentsMap = parentCommentsList.reduce((acc, comment) => {
            acc[comment.id] = comment
            return acc
          }, {})

          responseData.comments = allComments
          responseData.parentComments = parentCommentsMap
          responseData.users = users

          responseData.total = total
          break
        }

        case 'users': {
          // Get users using specialized method
          const { users, total } = await this.markerManager.getMarkedUsers(
            profile.id,
            markerTypes,
            filter,
            page,
            perpage,
          )

          responseData.users = Object.fromEntries(Object.entries(users).map(([id, user]) => [parseInt(id), user]))
          responseData.total = total
          break
        }
      }

      response.success(responseData)
    } catch (error) {
      this.logger.error('Could not get user marked content', { username, contentType, error })
      return response.error('error', `Could not get marked content for user ${username}`, 500)
    }
  }
}
