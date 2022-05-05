import {Router} from 'express';
import UserManager from '../managers/UserManager';
import rateLimit from 'express-rate-limit';
import {Logger} from 'winston';
import {APIRequest, APIResponse, validate} from './ApiMiddleware';
import Joi from 'joi';
import {UserEntity} from './types/entities/UserEntity';
import {AuthSignInRequest, AuthSignInResponse} from './types/requests/AuthSignIn';

type SignOutRequest = Record<string, unknown>;
type SignOutResponse = Record<string, unknown>;

export default class AuthController {
    public router = Router();
    private userManager: UserManager;
    private logger: Logger;

    constructor(userManager: UserManager, logger: Logger) {
        this.userManager = userManager;
        this.logger = logger;

        // 5 failed requests per hour
        const signInLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 5,
            skipSuccessfulRequests: true,
            standardHeaders: false,
            legacyHeaders: false
        });

        const signInSchema = Joi.object<AuthSignInRequest>({
            username: Joi.string().required(),
            password: Joi.string().required(),
        });

        this.router.post('/auth/signin', signInLimiter, validate(signInSchema), (req, res) => this.signin(req, res));
        this.router.post('/auth/signout', (req, res) => this.signout(req, res));
    }

    async signin(request: APIRequest<AuthSignInRequest>, response: APIResponse<AuthSignInResponse>) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        const {username, password} = request.body;

        try {
            const userInfo = await this.userManager.checkPassword(username, password);
            if (!userInfo) {
                this.logger.warn(`Wrong username: @${username}`, { username: username });
                return response.error('wrong-credentials', 'Wrong username or password');
            }

            const sessionId = await request.session.init();

            const user: UserEntity = {
                id: userInfo.id,
                gender: userInfo.gender,
                username: userInfo.username,
                name: userInfo.name,
                karma: userInfo.karma
            };

            request.session.data.userId = userInfo.id;
            await request.session.store();

            response.success({
                user: user,
                session: sessionId
            });

            this.logger.info(`User @${userInfo.username} signed in`, { username: userInfo.username, user_id: userInfo.id });
        }
        catch (err) {
            this.logger.error('Sign in failed', { error: err, username: username });
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async signout(request: APIRequest<SignOutRequest>, response: APIResponse<SignOutResponse>) {
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
