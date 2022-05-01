import {Router} from 'express';
import UserManager from '../db/managers/UserManager';
import {User} from '../types/User';
import {APIRequest, APIResponse} from './ApiMiddleware';

type StatusRequest = Record<string, unknown>;
type StatusResponse = {
    user: User;
    bookmarks: {
        posts: number;
        comments: number;
    };
    notifications: number;
};

export default class StatusController {
    public router = Router();
    private userManager: UserManager

    constructor(userManager: UserManager) {
        this.userManager = userManager;
        this.router.post('/status', (req, res) => this.status(req, res))
    }

    async status(request: APIRequest<StatusRequest>, response: APIResponse<StatusResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        try {
            const userId = request.session.data.userId;
            const user = await this.userManager.get(userId);

            if (!user) {
                // Something wrong, user should exist!
                return response.error('error', 'Unknown error', 500);
            }

            return response.success({
                user: user,
                bookmarks: {
                    posts: 0,
                    comments: 0,
                },
                notifications: 0
            })
        }
        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }
}
