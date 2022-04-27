import {Router} from 'express';
import UserManager from '../db/managers/UserManager';
import {User} from '../types/User';
import {APIRequest, APIResponse} from './ApiMiddleware';

interface MeRequest {

}
interface MeResponse {
    user: User;
    bookmarks: {
        posts: number;
        comments: number;
    };
    notifications: number;
}

export default class MeController {
    public router = Router();
    private userManager: UserManager

    constructor(userManager: UserManager) {
        this.userManager = userManager;
        this.router.post('/me', (req, res) => this.me(req, res))
    }

    async me(request: APIRequest<MeRequest>, response: APIResponse<MeResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        try {
            let userId = request.session.data.userId;
            let user = await this.userManager.get(userId);

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
