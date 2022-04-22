import express from 'express';
import InviteManager from '../db/managers/InviteManager';
import {User, UserGender} from '../types/User';
import bcrypt from 'bcryptjs';
import CodeError from '../CodeError';
import rateLimit from 'express-rate-limit';

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
    public router = express.Router();
    private inviteManager: InviteManager

    constructor(inviteManager: InviteManager) {
        this.inviteManager = inviteManager;

        // 10 requests per hour
        let limiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            skipSuccessfulRequests: true,
            standardHeaders: false,
            legacyHeaders: false
        });

        this.router.post('/invite/check', limiter, (req, res) => this.checkInvite(req, res))
        this.router.post('/invite/use', limiter, (req, res) => this.useInvite(req, res))
        // this.router.post('/invite/lepra', limiter, (req, res) => this.lepra(req, res))
    }

    async checkInvite(request: express.Request, response: express.Response) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        try {
            let body = <CheckRequest> request.body;
            if (!body.code) {
                return response.error('code-required', 'Invite code required');
            }

            let invite = await this.inviteManager.get(body.code);
            if (!invite || invite.left_count < 1) {
                return response.error('invalid-code', 'Invite code not found or already used');
            }

            return response.success({
                code: invite.code,
                inviter: invite.issuer
            } as CheckResponse);
        }
        catch (e) {
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    private async hashPassword(password: string) {
        return new Promise<string>((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(hash);
            });
        });
    }

    async useInvite(request: express.Request, response: express.Response) {
        if (request.session.data.userId) {
            return response.error('signed-in', 'Already signed in');
        }

        try {
            let body = <UseRequest> request.body;
            if (!body.code || !body.username || !body.email || !body.name || !body.password) {
                response.status(400).send({result: 'error', code: 'invalid-payload', message: 'Invalid payload'});
                return;
            }

            if (!body.username.match(/^[a-zа-я0-9_-]{2,30}$/i)) {
                response.status(400).send({result: 'error', code: 'invalid-username', message: 'Invalid username'});
                return;
            }

            if (!body.email.match(/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/)) {
                response.status(400).send({result: 'error', code: 'invalid-email', message: 'Invalid email'});
                return;
            }

            let passwordHash = await this.hashPassword(body.password)

            let user = await this.inviteManager.use(body.code, body.username, body.name, body.email, passwordHash, body.gender);

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
            } as UseResponse);
        }
        catch (err) {
            if (err instanceof CodeError) {
                if (err.code === 'username-exists') {
                    response.status(400).send({result: 'error', code: 'username-exists', message: 'Username already exists'});
                    return;
                }
                if (err.code === 'invite-not-found') {
                    response.status(404).send({result: 'error', code: 'invalid-invite', message: 'Invite not found or used'});
                    return;
                }
            }

            response.status(500).send({result: 'error', code: 'unknown', message: 'Unknown error'});
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
