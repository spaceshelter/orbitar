import {Router} from 'express';
import InviteManager from '../db/managers/InviteManager';
import {User, UserGender} from '../types/User';
import bcrypt from 'bcryptjs';
import CodeError from '../CodeError';
import rateLimit from 'express-rate-limit';
import {Logger} from 'winston';
import {APIRequest, APIResponse, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';

interface CheckRequest {
    code: string;
}
interface CheckResponse {
    code: string;
    inviter: string;
}

interface UseRequest {
    code: string;
    username: string;
    name: string;
    email: string;
    gender: UserGender;
    password: string;
}
interface UseResponse {
    user: User;
    session: string;
}

// interface LepraRequest {
//     code: string;
// }

export default class InviteController {
    public router = Router();
    private inviteManager: InviteManager
    private logger: Logger;

    constructor(inviteManager: InviteManager, logger: Logger) {
        this.inviteManager = inviteManager;
        this.logger = logger;

        // 10 requests per hour
        let limiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            skipSuccessfulRequests: true,
            standardHeaders: false,
            legacyHeaders: false
        });

        const checkSchema = Joi.object<CheckRequest>({
            code: Joi.string().alphanum().required()
        });
        const useSchema = Joi.object<UseRequest>({
            code: Joi.string().alphanum().required(),
            username: joiUsername,
            name: Joi.string().required(),
            email: Joi.string().email().required(),
            gender: Joi.number().valid(0, 1, 2).default(0),
            password: Joi.string().required()
        });

        this.router.post('/invite/check', limiter, validate(checkSchema), (req, res) => this.checkInvite(req, res))
        this.router.post('/invite/use', limiter, validate(useSchema), (req, res) => this.useInvite(req, res))
        // this.router.post('/invite/lepra', limiter, (req, res) => this.lepra(req, res))
    }

    async checkInvite(request: APIRequest<CheckRequest>, response: APIResponse<CheckResponse>) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        const {code} = request.body;

        try {
            let invite = await this.inviteManager.get(code);
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

    async useInvite(request: APIRequest<UseRequest>, response: APIResponse<UseResponse>) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        const {code, username, email, name, password, gender} = request.body;

        try {
            let passwordHash = await bcrypt.hash(password, 10);

            let user = await this.inviteManager.use(code, username, name, email, passwordHash, gender);

            this.logger.info(`Invite ${code} used by #${user.user_id} @${user.username}`, { invite: code, username });

            let sessionId = await request.session.init();

            let resUser = {
                id: user.user_id,
                gender: user.gender,
                username: user.username,
                name: user.name,
                karma: user.karma
            };

            request.session.data.userId = user.user_id;
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
