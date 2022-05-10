import {Router} from 'express';
import UserManager from '../managers/UserManager';
import {APIRequest, APIResponse, joiFormat, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';
import {Logger} from 'winston';
import {UserProfileRequest, UserProfileResponse} from './types/requests/UserProfile';
import {UserPostsRequest, UserPostsResponse} from './types/requests/UserPosts';
import PostManager from '../managers/PostManager';
import {SiteBaseEntity} from './types/entities/SiteEntity';
import {UserCommentsRequest, UserCommentsResponse} from './types/requests/UserComments';

export default class UserController {
    public router = Router();
    private userManager: UserManager;
    private postManager: PostManager;
    private logger: Logger;

    constructor(userManager: UserManager, postManager: PostManager, logger: Logger) {
        this.userManager = userManager;
        this.postManager = postManager;
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

        this.router.post('/user/profile', validate(profileSchema), (req, res) => this.profile(req, res));
        this.router.post('/user/posts', validate(postsOrCommentsSchema), (req, res) => this.posts(req, res));
        this.router.post('/user/comments', validate(postsOrCommentsSchema), (req, res) => this.comments(req, res));
    }

    async profile(request: APIRequest<UserProfileRequest>, response: APIResponse<UserProfileResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { username } = request.body;

        try {
            const profile = await this.userManager.getFullProfile(username, userId);

            if (!profile) {
                return response.error('not-found', 'User not found', 404);
            }

            const invites = await this.userManager.getInvites(profile.id);
            const invitedBy = await this.userManager.getInvitedBy(profile.id);

            return response.success({
                profile: profile,
                invitedBy: invitedBy,
                invites: invites
            });
        }
        catch (error) {
            this.logger.error('Could not get user profile', { username, error });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async posts(request: APIRequest<UserPostsRequest>, response: APIResponse<UserPostsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { username, format, page, perpage } = request.body;

        try {
            const profile = await this.userManager.getFullProfile(username, userId);

            if (!profile) {
                return response.error('not-found', 'User not found', 404);
            }

            const total = await this.postManager.getPostsByUserTotal(profile.id);
            const rawPosts = await this.postManager.getPostsByUser(profile.id, userId,  page || 1, perpage || 20);
            const { posts, users, sites } = await this.postManager.enrichRawPosts(rawPosts, format);
            // reformat sites
            const sitesByName: Record<string, SiteBaseEntity> =
                Object.fromEntries(Object.entries(sites).map(([_, site]) => { return [ site.site, site ]; }));

            response.success({
                posts: posts,
                total: total,
                users: users,
                sites: sitesByName
            });

        } catch (error) {
            this.logger.error('Could not get user posts', { username, error });
            return response.error('error', `Could not get posts for user ${username}`, 500);
        }
    }

    async comments(request: APIRequest<UserCommentsRequest>, response: APIResponse<UserCommentsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { username, format, page, perpage } = request.body;

        try {
            const profile = await this.userManager.getFullProfile(username, userId);

            if (!profile) {
                return response.error('not-found', 'User not found', 404);
            }

            const total = await this.postManager.getUserCommentsTotal(profile.id);
            const rawComments = await this.postManager.getUserComments(profile.id, userId, page || 1, perpage || 20);
            const {allComments, users, sites} = await this.postManager.enrichRawComments(rawComments, {}, format, (_) => false);

            response.success({
                comments: allComments,
                total,
                users,
                sites
            });
        } catch (error) {
            this.logger.error('Could not get user comments', { username, error });
            return response.error('error', `Could not get comments for user ${username}`, 500);
        }
    }
}
