import {Router} from 'express';
import InviteManager from '../managers/InviteManager';
import bcrypt from 'bcryptjs';
import CodeError from '../CodeError';
import rateLimit from 'express-rate-limit';
import {Logger} from 'winston';
import {APIRequest, APIResponse, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';
import UserManager from '../managers/UserManager';
import {UserEntity} from './types/entities/UserEntity';
import {InviteCheckRequest, InviteCheckResponse} from './types/requests/InviteCheck';
import {InviteUseRequest, InviteUseResponse} from './types/requests/InviteUse';

export default class InviteController {
    public router = Router();
    private inviteManager: InviteManager;
    private userManager: UserManager;
    private logger: Logger;

    constructor(inviteManager: InviteManager, userManager: UserManager, logger: Logger) {
        this.inviteManager = inviteManager;
        this.userManager = userManager;

        this.logger = logger;

        // 10 requests per hour
        const limiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            skipSuccessfulRequests: true,
            standardHeaders: false,
            legacyHeaders: false
        });

        const checkSchema = Joi.object<InviteCheckRequest>({
            code: Joi.string().alphanum().required()
        });
        const useSchema = Joi.object<InviteUseRequest>({
            code: Joi.string().alphanum().required(),
            username: joiUsername,
            name: Joi.string().required(),
            email: Joi.string().email().required(),
            gender: Joi.number().valid(0, 1, 2).default(0),
            password: Joi.string().required()
        });

        this.router.post('/invite/check', limiter, validate(checkSchema), (req, res) => this.checkInvite(req, res));
        this.router.post('/invite/use', limiter, validate(useSchema), (req, res) => this.useInvite(req, res));
        // this.router.post('/invite/lepra', limiter, (req, res) => this.lepra(req, res))
    }

    async checkInvite(request: APIRequest<InviteCheckRequest>, response: APIResponse<InviteCheckResponse>) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        const {code} = request.body;

        try {
            const invite = await this.inviteManager.get(code);
            if (!invite || invite.left_count < 1) {
                this.logger.warn(`Invalid or expired invite checked: ${code}`, { invite: code });
                return response.error('invalid-code', 'Invite code not found or already used');
            }

            return response.success({
                code: invite.code,
                inviter: invite.issuer
            });
        }
        catch (err) {
            this.logger.error(`Check invite failed`, { error: err, invite: code });
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async useInvite(request: APIRequest<InviteUseRequest>, response: APIResponse<InviteUseResponse>) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        const {code, username, email, name, password, gender} = request.body;

        try {
            const passwordHash = await bcrypt.hash(password, 10);

            const user = await this.userManager.registerByInvite(code, username, name, email, passwordHash, gender);

            this.logger.info(`Invite ${code} used by #${user.id} @${user.username}`, { invite: code, username });

            const sessionId = await request.session.init();

            const resUser: UserEntity = {
                id: user.id,
                gender: user.gender,
                username: user.username,
                name: user.name,
                karma: user.karma
            };

            request.session.data.userId = user.id;
            await request.session.store();

            response.success({
                user: resUser,
                session: sessionId
            });
        }
        catch (err) {
            if (err instanceof CodeError) {
                if (err.code === 'username-exists') {
                    this.logger.warn(`Trying to register with existing username: ${username}`, { invite: code, username });
                    return response.error('username-exists', 'Username already exists');
                }
                if (err.code === 'invite-not-found') {
                    this.logger.warn(`Trying to register with invalid invite: ${code}`, { invite: code, username });
                    return response.error('invalid-invite', 'Invite not found or used');
                }
            }

            this.logger.error(`Invite use failed`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    // async lepra(request: express.Request, response: express.Response) {
    //     if (request.session.user) {
    //         response.status(403).send({ result: 'error', code: '403', message: 'Already registered' });
    //         return;
    //     }
    //
    //     try {
    //         let body = <LepraRequest> request.body;
    //         if (!body.code) {
    //             response.status(400).send({result: 'error', code: 'invalid-payload', message: 'Invalid payload'});
    //             return;
    //         }
    //
    //
    //     }
    //     catch (e) {
    //         response.status(500).send({result: 'error', code: 'unknown', message: 'Unknown error'});
    //     }
    // }

}
