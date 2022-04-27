import {Router} from 'express';
import VoteManager from '../db/managers/VoteManager';
import {User} from '../types/User';
import {Logger} from 'winston';
import {APIRequest, APIResponse, validate} from './ApiMiddleware';
import Joi from 'joi';

type VoteType = 'post' | 'comment' | 'user';

interface VoteRequest {
    type: VoteType;
    id: number;
    vote: number;
}
interface VoteResponse {
    type: VoteType;
    id: number;
    rating: number;
    vote?: number;
}

interface ListRequest {
    type: VoteType;
    id: number;
}
interface ListResponse {
    type: VoteType;
    id: number;
    rating: number;
    votes: {
        vote: number;
        user: User;
    }[]
}


export default class VoteController {
    public router = Router();
    private voteManager: VoteManager;
    private logger: Logger;

    constructor(voteManager: VoteManager, logger: Logger) {
        this.voteManager = voteManager;
        this.logger = logger;

        const voteSchema = Joi.object<VoteRequest>({
            type: Joi.valid('post', 'comment', 'user').required(),
            id: Joi.number().required(),
            vote: Joi.number().required()
        });
        const listSchema = Joi.object<ListRequest>({
            type: Joi.valid('post', 'comment', 'user').required(),
            id: Joi.number().required()
        });

        this.router.post('/vote/set', validate(voteSchema), (req, res) => this.setVote(req, res));
        this.router.post('/vote/list', validate(listSchema), (req, res) => this.list(req, res));
    }

    async setVote(request: APIRequest<VoteRequest>, response: APIResponse<VoteResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        let {id, type, vote} = request.body;

        try {
            vote = Math.max(Math.min(vote, 1), -1);

            let rating;
            switch (type) {
                case 'post':
                    rating = await this.voteManager.postVote(id, vote, userId);
                    break;
                case 'comment':
                    rating = await this.voteManager.commentVote(id, vote, userId);
                    break;
                case 'user':
                    rating = await this.voteManager.userVote(id, vote, userId);
                    break;
                default:
                    return response.error('wrong-type', 'Wrong type', 401);
            }

            this.logger.info(`User #${userId} voted on ${type} with ${vote}`, { vote: vote, type: type, user_id: userId, item_id: id });

            response.success({
                type: type,
                id: id,
                rating: rating,
                vote: vote
            });
        }

        catch (err) {
            this.logger.error('Vote error', { error: err, user_id: userId, vote: vote, type: type, item_id: id });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async list(request: APIRequest<ListRequest>, response: APIResponse<ListResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        response.error('not-implemented','Not implemented', 404);
    }
}
