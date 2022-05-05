import {Router} from 'express';
import UserManager from '../managers/UserManager';
import {APIRequest, APIResponse, joiFormat, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';
import {Logger} from 'winston';
import {UserProfileRequest, UserProfileResponse} from './types/requests/UserProfile';
import {UserPostsRequest} from './types/requests/UserPosts';

export default class UserController {
    public router = Router();
    private userManager: UserManager;
    private logger: Logger;

    constructor(userManager: UserManager, logger: Logger) {
        this.userManager = userManager;
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

    async posts(request: APIRequest<UserProfileRequest>, response: APIResponse<UserProfileResponse>) {

    }

    async comments(request: APIRequest<UserProfileRequest>, response: APIResponse<UserProfileResponse>) {

    }
}
