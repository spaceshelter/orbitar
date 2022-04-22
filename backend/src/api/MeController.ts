import express from 'express';
import UserManager from '../db/managers/UserManager';
import rateLimit from 'express-rate-limit';
import {User} from '../types/User';

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
    public router = express.Router();
    private userManager: UserManager

    constructor(userManager: UserManager) {
        this.userManager = userManager;
        this.router.post('/me', (req, res) => this.me(req, res))
    }

    async me(request: express.Request, response: express.Response) {
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

            response.send({
                result: 'success',
                payload: {
                    user: user,
                    bookmarks: {
                        posts: 0,
                        comments: 0
                    },
                    notifications: 0
                } as MeResponse
            });
        }
        catch (err) {
            response.send({result: 'error', code: 'unknown', message: 'Unknown error'});
        }
    }
}
