import express from 'express';
import DB from '../db/DB';

interface VoteRequest {
    id: number;
    vote: number;
}
interface VoteResponse {
    rating: number;
    vote?: number;
}

type RawPostVote = {
    vote_id: number;
    post_id: number;
    voter_id: number;
    vote: number;
    voted_at: Date;
}
type RawCommentVote = {
    vote_id: number;
    comment_id: number;
    voter_id: number;
    vote: number;
    voted_at: Date;
}

export default class VoteController {
    public router = express.Router();
    private db: DB;

    constructor(db: DB) {
        this.db = db;
        this.router.post('/vote/post/vote', (req, res) => this.postVote(req, res));
        this.router.post('/vote/comment/vote', (req, res) => this.commentVote(req, res));
    }

    async postVote(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        try {
            let userId = request.session.data.userId;
            let body = <VoteRequest> request.body;

            let id = body.id;
            let vote = body.vote;

            if (!id) {
                return response.error('id-required', 'Post id required');
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

            let currentVoteResult = await this.db.execute('select * from post_votes where post_id=:post_id and voter_id=:voter_id', {
                post_id: id,
                voter_id: userId
            });
            let currentVote = (<RawPostVote[]> currentVoteResult)[0];
            if (!currentVote) {
                await this.db.execute('insert into post_votes (post_id, voter_id, vote) values (:post_id, :voter_id, :vote)', {
                    post_id: id,
                    voter_id: userId,
                    vote: vote
                });
            }
            else if (currentVote.vote !== vote) {
                await this.db.execute('update post_votes set vote=:vote where vote_id=:vote_id', {
                    vote_id: currentVote.vote_id,
                    vote: vote
                });
            }

            let ratingResult = await this.db.execute('select sum(vote) rating from post_votes where post_id = :post_id', {
                post_id: id
            });
            let rating = ratingResult[0].rating || 0;

            await this.db.execute('update posts set rating=:rating where post_id=:post_id', {
                rating: rating,
                post_id: id
            });

            response.success({
                rating: rating,
                vote: vote
            } as VoteResponse);
        }

        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }

    async commentVote(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        try {
            let userId = request.session.data.userId;
            let body = <VoteRequest> request.body;

            let id = body.id;
            let vote = body.vote;

            if (!id) {
                return response.error('id-required', 'Post id required');
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

            let currentVoteResult = await this.db.execute('select * from comment_votes where comment_id=:comment_id and voter_id=:voter_id', {
                comment_id: id,
                voter_id: userId
            });
            let currentVote = (<RawCommentVote[]> currentVoteResult)[0];
            if (!currentVote) {
                await this.db.execute('insert into comment_votes (comment_id, voter_id, vote) values (:comment_id, :voter_id, :vote)', {
                    comment_id: id,
                    voter_id: userId,
                    vote: vote
                });
            }
            else if (currentVote.vote !== vote) {
                await this.db.execute('update comment_votes set vote=:vote where vote_id=:vote_id', {
                    vote_id: currentVote.vote_id,
                    vote: vote
                });
            }

            let ratingResult = await this.db.execute('select sum(vote) rating from comment_votes where comment_id = :comment_id', {
                comment_id: id
            });
            let rating = ratingResult[0].rating || 0;

            await this.db.execute('update comments set rating=:rating where comment_id=:comment_id', {
                rating: rating,
                comment_id: id
            });

            response.success({
                rating: rating,
                vote: vote
            } as VoteResponse);
        }

        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }
}
