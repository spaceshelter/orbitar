import express from 'express';
import DB from '../db/DB';
import VoteManager from '../db/managers/VoteManager';
import {User} from '../types/User';

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
    public router = express.Router();
    private db: DB;
    private voteManager: VoteManager;

    constructor(db: DB, voteManager: VoteManager) {
        this.db = db;
        this.voteManager = voteManager;
        this.router.post('/vote/set', (req, res) => this.setVote(req, res));
        this.router.post('/vote/list', (req, res) => this.list(req, res));
    }

    async setVote(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        try {
            let userId = request.session.data.userId;
            let body = <VoteRequest> request.body;

            let type = body.type;
            let id = body.id;
            let vote = body.vote;

            if (!id) {
                return response.error('id-required', 'id required');
            }

            if (vote < 0) {
                vote = -1;
            }
            else if (vote > 0) {
                vote = 1;
            }
            else {
                vote = 0;
            }

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
                    return response.error('wrong-type', 'Wrong type');
            }

            response.success<VoteResponse>({
                type: type,
                id: id,
                rating: rating,
                vote: vote
            });
        }

        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }

    async list(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

    }
}
