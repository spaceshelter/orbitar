import {Router} from 'express';
import UserManager from '../managers/UserManager';
import rateLimit from 'express-rate-limit';
import {Logger} from 'winston';
import {APIRequest, APIResponse, validate} from './ApiMiddleware';
import Joi from 'joi';
import {UserEntity} from './types/entities/UserEntity';
import {AuthSignInRequest, AuthSignInResponse} from './types/requests/AuthSignIn';
import {
    AuthResetPasswordRequest,
    AuthResetPasswordResponse,
    AuthNewPasswordRequest,
    AuthNewPasswordResponse,
    AuthCheckResetPasswordCodeRequest,
    AuthCheckResetPasswordCodeResponse
} from './types/requests/AuthResetPassword';

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

        // 5 requests per hour
        const resetPaswsordLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 5
        });

        const signInSchema = Joi.object<AuthSignInRequest>({
            username: Joi.string().required(),
            password: Joi.string().required(),
        });

        const resetPasswordSchema = Joi.object<AuthResetPasswordRequest>({
            email: Joi.string().email().required(),
        });

        const newPasswordSchema = Joi.object<AuthNewPasswordRequest>({
            password: Joi.string().required(),
            code: Joi.string().required().min(64).max(64)
        });

        const checkResetPasswordCodeSchema = Joi.object<AuthCheckResetPasswordCodeRequest>({
            code: Joi.string().required().min(64).max(64)
        });

        this.router.post('/auth/signin', signInLimiter, validate(signInSchema), (req, res) => this.signin(req, res));
        this.router.post('/auth/reset-password', resetPaswsordLimiter, validate(resetPasswordSchema), (req, res) => this.resetPaswsord(req, res));
        this.router.post('/auth/new-password', resetPaswsordLimiter, validate(newPasswordSchema), (req, res) => this.setNewPassword(req, res));
        this.router.post('/auth/check-reset-password-code', validate(checkResetPasswordCodeSchema), (req, res) => this.checkIfPasswordResetCodeExists(req, res));
        this.router.post('/auth/signout', (req, res) => this.signout(req, res));
    }

    async resetPaswsord(request: APIRequest<AuthResetPasswordRequest>, response: APIResponse<AuthResetPasswordResponse>) {
        const {email} = request.body;

        try {
            const result = await this.userManager.sendResetPasswordEmail(email, this.logger);
            if (!result) {
                response.error('reset-password-initiation-failed', 'Failed to generate password reset link and email');
                return;
            }
            response.success({
                result: true
            });
        } catch (err) {
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async setNewPassword(request: APIRequest<AuthNewPasswordRequest>, response: APIResponse<AuthNewPasswordResponse>) {
        const {password, code} = request.body;

        try {
            const result = await this.userManager.setNewPassword(password, code);
            if (!result) {
                response.error('new-password-failed', 'Failed to set new password');
                return;
            }
            response.success({
                result: true
            });
        } catch (err) {
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async checkIfPasswordResetCodeExists(request: APIRequest<AuthCheckResetPasswordCodeRequest>, response: APIResponse<AuthCheckResetPasswordCodeResponse>) {
        const {code} = request.body;
        try {
            const result = await this.userManager.checkIfPasswordResetCodeExists(code);
            if (!result) {
                response.error('new-password-failed', 'Failed to find reset password code');
                return;
            }
            response.success({
                result: true
            });
        } catch (err) {
            return response.error('unknown', 'Unknown error', 500);
        }
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
