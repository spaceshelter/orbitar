import express from 'express';
import UserManager from '../db/managers/UserManager';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {User} from '../types/User';

interface SignInRequest {
    username: string;
    password: string;
}
interface SignInResponse {
    user: User;
    session: string;
}

export default class AuthController {
    public router = express.Router();
    private userManager: UserManager

    constructor(userManager: UserManager) {
        this.userManager = userManager;

        // 5 failed requests per hour
        let signInLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 5,
            skipSuccessfulRequests: true,
            standardHeaders: false,
            legacyHeaders: false
        });

        this.router.post('/auth/signin', signInLimiter, (req, res) => this.signin(req, res))
        this.router.post('/auth/signout', (req, res) => this.signout(req, res))
    }

    async signin(request: express.Request, response: express.Response) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        try {
            let body = <SignInRequest> request.body;
            if (!body.username || !body.password) {
                return response.error('credentials-required', 'Credentials required')
            }

            let userRow = await this.userManager.getRaw(body.username);
            if (!userRow) {
                return response.error('wrong-credentials', 'Wrong username or password');
            }

            if (!bcrypt.compareSync(body.password, userRow.password)) {
                return response.error('wrong-credentials', 'Wrong username or password');
            }

            let sessionId = await request.session.init();

            let user = {
                id: userRow.user_id,
                gender: userRow.gender,
                username: userRow.username,
                name: userRow.name,
                karma: userRow.karma
            };

            request.session.data.userId = userRow.user_id;
            await request.session.store();

            response.success({
                user: user,
                session: sessionId
            } as SignInResponse)
        }
        catch (err) {
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async signout(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        try {
            await request.session.destroy();
            return response.success({});
        }
        catch (err) {
            return response.error('unknown', 'Unknown error', 500);
        }
    }
}
