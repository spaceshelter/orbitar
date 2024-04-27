import {Router} from 'express';
import InviteManager from '../managers/InviteManager';
import bcrypt from 'bcryptjs';
import CodeError from '../CodeError';
import rateLimit from 'express-rate-limit';
import {Logger} from 'winston';
import {APIRequest, APIResponse, joiPassword, joiUsername, validate} from './ApiMiddleware';
import Joi from 'joi';
import UserManager from '../managers/UserManager';
import {UserEntity} from './types/entities/UserEntity';
import {InviteCheckRequest, InviteCheckResponse} from './types/requests/InviteCheck';
import {InviteUseRequest, InviteUseResponse} from './types/requests/InviteUse';
import {InviteListRequest, InviteListResponse} from './types/requests/InviteList';
import {InviteEntity} from './types/entities/InviteEntity';
import {InviteRegenerateRequest, InviteRegenerateResponse} from './types/requests/InviteRegenerate';
import {InviteRawWithIssuer} from '../db/types/InviteRaw';
import { ERROR_CODES } from './utils/error-codes';
import {InviteCreateRequest, InviteDeleteRequest} from './types/requests/Invite';
import {Enricher} from './utils/Enricher';
import {InviteEditRequest} from './types/requests/InviteEdit';

export default class InviteController {
    public router = Router();
    private inviteManager: InviteManager;
    private userManager: UserManager;
    private enricher: Enricher;
    private logger: Logger;

    constructor(inviteManager: InviteManager, userManager: UserManager, enricher: Enricher, logger: Logger) {
        this.inviteManager = inviteManager;
        this.userManager = userManager;
        this.enricher = enricher;

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
            name: Joi.string().required().max(100),
            email: Joi.string().email().required(),
            gender: Joi.number().valid(0, 1, 2).default(0),
            password: joiPassword.required()
        });
        const codeSchema = Joi.object<InviteCheckRequest>({
            code: Joi.string().alphanum().required()
        });
        const editSchema = Joi.object<InviteEditRequest>({
            code: Joi.string().alphanum().required(),
            reason: Joi.string().min(1).max(50000).required(),
        });
        const createSchema = Joi.object<InviteCreateRequest>({
            reason: Joi.string().min(1).max(50000).required(),
        });
        const listSchema = Joi.object<InviteListRequest>({
            username: joiUsername
        });

        this.router.post('/invite/check', limiter, validate(checkSchema), (req, res) => this.checkInvite(req, res));
        this.router.post('/invite/use', limiter, validate(useSchema), (req, res) => this.useInvite(req, res));
        this.router.post('/invite/list', limiter, validate(listSchema), (req, res) => this.list(req, res));
        this.router.post('/invite/regenerate', limiter, validate(codeSchema), (req, res) => this.regenerate(req, res));
        this.router.post('/invite/create', limiter, validate(createSchema), (req, res) => this.create(req, res));
        this.router.post('/invite/delete', limiter, validate(codeSchema), (req, res) => this.delete(req, res));
        this.router.post('/invite/edit', limiter, validate(editSchema), (req, res) => this.edit(req, res));
    }

    async verifyInvitePermissions(invite: InviteRawWithIssuer) {
        const issuerRestrictions = await this.userManager.getUserRestrictions(invite.issued_by);
        if (!issuerRestrictions.canInvite) {
            this.logger.warn(`Invite issuer ${invite.issued_by} has no permission to invite`,
                {invite: invite.code});
            return false;
        }
        return true;
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
                return response.error(ERROR_CODES.INVALID_CODE, 'Invite code not found or already used');
            }

            if (!await this.verifyInvitePermissions(invite)) {
                return response.error(ERROR_CODES.INVALID_CODE, 'Invite code can\'t be used');
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
            const invite = await this.inviteManager.get(code);
            if (!invite || !await this.verifyInvitePermissions(invite)) {
                return response.error(ERROR_CODES.INVALID_CODE, 'Invite code not found or already used');
            }

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

    async list(request: APIRequest<InviteListRequest>, response: APIResponse<InviteListResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const {username: forUsername} = request.body;
        const forUser = await this.userManager.getByUsername(forUsername);
        if (!forUser) {
            return response.error('user-not-found', 'User not found');
        }


        const userId = request.session.data.userId;
        const isSelf = userId === forUser.id;
        const canInvite = (await this.userManager.getUserRestrictions(userId)).canInvite;

        try {
            const invites = await this.inviteManager.listInvites(forUser.id);
            const invitesAvailability = isSelf && canInvite &&
                await this.inviteManager.getInvitesAvailability(forUser.id, true);

            const active: InviteEntity[] = [];
            const inactive: InviteEntity[] = [];

            for (const invite of invites) {
                const entity = this.enricher.inviteToEntity(invite);

                if (invite.leftCount > 0) {
                    active.push(entity);
                }
                if (invite.invited.length > 0) {
                    inactive.push(entity);
                }
            }
            if (!isSelf || !canInvite) {
                active.length = 0;
                for (const invite of inactive) {
                    invite.code = '';
                }
            }

            return response.success({
                active,
                inactive,
                invitesAvailability
            });
        }
        catch (err) {
            this.logger.error(`Invite list failed`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async regenerate(request: APIRequest<InviteRegenerateRequest>, response: APIResponse<InviteRegenerateResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {code} = request.body;

        try {
            const newCode = await this.inviteManager.regenerate(userId, code);

            response.success({
                code: newCode
            });
        }
        catch (err) {
            if (err instanceof CodeError && err.code === 'access-denied') {
                return response.error('access-denied', 'Access-denied');
            }

            this.logger.error(`Invite regenerate failed`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async create(request: APIRequest<InviteCreateRequest>, response: APIResponse<InviteEntity>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;

        try {
            if (!(await this.userManager.getUserRestrictions(userId)).canInvite) {
                this.logger.warn(`User ${userId} has no permission to create invites`, {user: userId});
                return response.error(ERROR_CODES.NO_PERMISSION, 'No permission to create invites', 403);
            }

            // FIXME potential race condition between availability check and invite creation
            if ((await this.inviteManager.getInvitesAvailability(userId, true)).invitesLeft === 0) {
                this.logger.warn(`User ${userId} has no more invites left to create`, {user: userId});
                return response.error(ERROR_CODES.NO_PERMISSION, 'No more invites left to create', 403);
            }

           const invite = await this.inviteManager.createInvite(userId, request.body.reason);
           const entity = this.enricher.inviteToEntity(invite);

            return response.success(entity);
        }
        catch (err) {
            this.logger.error(`Invite creation failed`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async edit(request: APIRequest<InviteEditRequest>, response: APIResponse<InviteEntity>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {code, reason} = request.body;

        try {
            const invite = await this.inviteManager.editInvite(userId, code, reason);
            const entity = this.enricher.inviteToEntity(invite);

            return response.success(entity);
        }
        catch (err) {
            this.logger.error(`Invite edit failed`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    private delete(req: APIRequest<InviteDeleteRequest>, res: APIResponse<boolean>) {
        if (!req.session.data.userId) {
            return res.authRequired();
        }

        const userId = req.session.data.userId;
        const {code} = req.body;

        this.inviteManager.delete(userId, code)
            .then(_ => res.success(_))
            .catch(err => {
                this.logger.error(`Invite delete failed`, {error: err});
                return res.error('unknown', 'Unknown error', 500);
            });
    }
}
