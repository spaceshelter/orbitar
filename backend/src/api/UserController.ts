import {Router} from 'express';
import UserManager from '../managers/UserManager';
import {APIRequest, APIResponse, joiFormat, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';
import {Logger} from 'winston';
import {
    UserKarmaResponse,
    UserProfileRequest,
    UserProfileResponse,
    UserRestrictionsResponse,
    UserSaveBioRequest,
    UserSaveBioResponse
} from './types/requests/UserProfile';
import {UserPostsRequest, UserPostsResponse} from './types/requests/UserPosts';
import PostManager from '../managers/PostManager';
import {Enricher} from './utils/Enricher';
import {UserCommentsRequest, UserCommentsResponse} from './types/requests/UserComments';
import {UserProfileEntity} from './types/entities/UserEntity';
import VoteManager from '../managers/VoteManager';
import {UserRatingBySubsite} from '../managers/types/UserInfo';

// constant variables
import {ERROR_CODES} from './utils/error-codes';
import InviteManager from '../managers/InviteManager';

export default class UserController {
    public readonly router = Router();
    private readonly userManager: UserManager;
    private readonly postManager: PostManager;
    private readonly voteManager: VoteManager;
    private readonly inviteManager: InviteManager;
    private readonly logger: Logger;
    private readonly enricher: Enricher;

    constructor(enricher: Enricher, userManager: UserManager, postManager: PostManager, voteManager: VoteManager, inviteManager: InviteManager, logger: Logger) {
        this.enricher = enricher;
        this.userManager = userManager;
        this.postManager = postManager;
        this.voteManager = voteManager;
        this.inviteManager = inviteManager;
        this.logger = logger;

        const profileSchema = Joi.object<UserProfileRequest>({
            username: joiUsername.required(),
        });
        const postsOrCommentsSchema = Joi.object<UserPostsRequest>({
            username: joiUsername.required(),
            format: joiFormat,
            page: Joi.number().default(1),
            perpage: Joi.number().min(1).max(50).default(10),
        });
        const bioSchema = Joi.object<UserSaveBioRequest>({
            bio: Joi.string().required().max(1024)
        });

        this.router.post('/user/profile', validate(profileSchema), (req, res) => this.profile(req, res));
        this.router.post('/user/posts', validate(postsOrCommentsSchema), (req, res) => this.posts(req, res));
        this.router.post('/user/comments', validate(postsOrCommentsSchema), (req, res) => this.comments(req, res));
        this.router.post('/user/karma', validate(profileSchema), (req, res) => this.karma(req, res));
        this.router.post('/user/clearCache', validate(profileSchema), (req, res) => this.clearCache(req, res));
        this.router.post('/user/restrictions', validate(profileSchema), (req, res) => this.restrictions(req, res));
        this.router.post('/user/savebio', validate(bioSchema), (req, res) => this.saveBio(req, res));
    }

    async profile(request: APIRequest<UserProfileRequest>, response: APIResponse<UserProfileResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {username} = request.body;

        try {
            const profileInfo = await this.userManager.getByUsernameWithVoteAndBio(username, userId);

            if (!profileInfo) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            const invites = await this.userManager.getInvites(profileInfo.id);
            const invitedBy = await this.userManager.getInvitedBy(profileInfo.id);
            const active = await this.userManager.isUserActive(profileInfo.id);
            const trialApprovers = await this.userManager.getTrialApprovers(profileInfo.id);
            const invitedReason = await this.inviteManager.getInviteReason(profileInfo.id);
            const trialProgress = await this.userManager.tryEndTrial(profileInfo.id, false);

            // FIXME: converter needed
            const profile: UserProfileEntity = {
                ...profileInfo, active
            } as unknown as UserProfileEntity;
            profile.registered = profileInfo.registered.toISOString();

            const enrichedInvites: UserProfileEntity[] = [];
            for (const u of invites) {
                const active = await this.userManager.isUserActive(u.id);
                enrichedInvites.push({
                    ...u,
                    active,
                    registered: u.registered.toISOString()
                });
            }

            return response.success({
                profile: profile,
                invitedBy: invitedBy,
                invites: enrichedInvites,
                trialApprovers: trialApprovers.length && trialApprovers,
                invitedReason,
                trialProgress
            });
        } catch (error) {
            this.logger.error('Could not get user profile', {username});
            this.logger.error(error);
            return response.error('error', 'Unknown error', 500);
        }
    }

    async posts(request: APIRequest<UserPostsRequest>, response: APIResponse<UserPostsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {username, format, page, perpage} = request.body;

        try {
            const profile = await this.userManager.getByUsername(username);

            if (!profile) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            const total = await this.postManager.getPostsByUserTotal(profile.id);
            const rawPosts = await this.postManager.getPostsByUser(profile.id, userId, page || 1, perpage || 20, format);
            const {posts, users} = await this.enricher.enrichRawPosts(rawPosts);

            response.success({
                posts,
                total,
                users
            });

        } catch (error) {
            this.logger.error('Could not get user posts', {username, error});
            return response.error('error', `Could not get posts for user ${username}`, 500);
        }
    }

    async comments(request: APIRequest<UserCommentsRequest>, response: APIResponse<UserCommentsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {username, format, page, perpage} = request.body;

        try {
            const profile = await this.userManager.getByUsername(username);

            if (!profile) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            const total = await this.postManager.getUserCommentsTotal(profile.id);
            const rawComments = await this.postManager.getUserComments(profile.id, userId, page || 1, perpage || 20, format);
            const rawParentComments = await this.postManager.getParentCommentsForASetOfComments(rawComments, userId, format);
            const {allComments, users} = await this.enricher.enrichRawComments(rawComments, {}, format, (_) => false);
            const {allComments:parentCommentsList} = await this.enricher.enrichRawComments(rawParentComments, users, format, (_) => false);

            const parentComments = parentCommentsList.reduce((acc, comment) => {
                acc[comment.id] = comment;
                return acc;
            }, {});

            response.success({
                comments: allComments,
                total,
                users,
                parentComments
            });
        } catch (error) {
            this.logger.error('Could not get user comments', {username, error});
            return response.error('error', `Could not get comments for user ${username}`, 500);
        }
    }

    async karma(request: APIRequest<UserProfileRequest>, response: APIResponse<UserKarmaResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const { username } = request.body;

        try {
            const profile = await this.userManager.getByUsername(username);

            if (!profile) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            const restrictions = await this.userManager.getUserRestrictions(profile.id);
            const ratingBySubsite: UserRatingBySubsite = await this.userManager.getUserRatingBySubsite(profile.id);
            const activeKarmaVotes = await this.userManager.getActiveKarmaVotes(profile.id);
            const trialProgress = await this.userManager.getTrialProgressRaw(profile.id);

            return response.success({
                effectiveKarma: restrictions.effectiveKarma,
                senatePenalty: restrictions.senatePenalty,
                activeKarmaVotes,
                postRatingBySubsite: ratingBySubsite.postRatingBySubsite,
                commentRatingBySubsite: ratingBySubsite.commentRatingBySubsite,
                trialProgress
            });
        }
        catch (error) {
            this.logger.error('Could not get user karma', { username, error });
            return response.error('error', `Could not get karma for user ${username}`, 500);
        }
    }

    async saveBio(request: APIRequest<UserSaveBioRequest>, response: APIResponse<UserSaveBioResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        const {bio} = request.body;
        try {
            const newBioPreview = await this.userManager.saveBio(bio, request.session.data.userId);
            if (newBioPreview === false) {
                return response.error('error', `Could not update bio`, 500);
            }
            this.userManager.clearCache(request.session.data.userId);
            return response.success({bio: newBioPreview});
        } catch (error) {
            this.logger.error('Could not update user bio', { error });
            return response.error('error', `Could not update bio`, 500);
        }
    }

    async restrictions(request: APIRequest<UserProfileRequest>, response: APIResponse<UserRestrictionsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const {username} = request.body;

        try {
            const profile = await this.userManager.getByUsername(username);

            if (!profile) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            const restrictions = await this.userManager.getUserRestrictions(profile.id);

            return response.success({
                ...restrictions
            });
        }
        catch (error) {
            this.logger.error('Could not get user restrictions', { username, error });
            return response.error('error', `Could not get restrictions for user ${username}`, 500);
        }
    }

    async clearCache(request: APIRequest<UserProfileRequest>, response: APIResponse<void>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        const {username} = request.body;

        try {
            const profile = await this.userManager.getByUsername(username);

            if (!profile) {
                return response.error(ERROR_CODES.NOT_FOUND, 'User not found', 404);
            }

            this.userManager.clearCache(profile.id);
            this.userManager.clearUserRestrictionsCache(profile.id);
        }
        catch (error) {
            this.logger.error('Something went wrong', { username, error });
            return response.error('error', `Could not get restrictions for user ${username}`, 500);
        }
    }
}
