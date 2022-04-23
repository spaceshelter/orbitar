import DB from '../DB';
import {CommentVoteRaw, PostVoteRaw, UserVoteRaw} from '../types/VoteRaw';
import PostManager from './PostManager';
import CodeError from '../../CodeError';

export default class VoteManager {
    private db: DB
    private postManager: PostManager;

    constructor(db: DB, postManager: PostManager) {
        this.db = db;
        this.postManager = postManager;
    }

    async postVote(postId: number, vote: number, userId: number): Promise<number> {
        let connection = await this.db.beginTransaction();
        try {
            let currentVoteResult = await this.db.execute('select * from post_votes where post_id=:post_id and voter_id=:voter_id', {
                post_id: postId,
                voter_id: userId
            }, connection);

            let currentVote = (<PostVoteRaw[]> currentVoteResult)[0];
            if (!currentVote) {
                await this.db.execute('insert into post_votes (post_id, voter_id, vote) values (:post_id, :voter_id, :vote)', {
                    post_id: postId,
                    voter_id: userId,
                    vote: vote
                }, connection);
            }
            else if (currentVote.vote !== vote) {
                await this.db.execute('update post_votes set vote=:vote where vote_id=:vote_id', {
                    vote_id: currentVote.vote_id,
                    vote: vote
                }, connection);
            }

            let ratingResult = await this.db.execute('select sum(vote) rating from post_votes where post_id=:post_id', {
                post_id: postId
            }, connection);
            let rating = ratingResult[0].rating || 0;

            await this.db.execute('update posts set rating=:rating where post_id=:post_id', {
                rating: rating,
                post_id: postId
            }, connection);

            await this.db.commit(connection);

            return rating;
        }
        catch {
            await this.db.rollback(connection);
        }
    }

    async commentVote(commentId: number, vote: number, userId: number): Promise<number> {
        let connection = await this.db.beginTransaction();
        try {
            let currentVoteResult = await this.db.execute('select * from comment_votes where comment_id=:comment_id and voter_id=:voter_id', {
                comment_id: commentId,
                voter_id: userId
            }, connection);

            let currentVote = (<CommentVoteRaw[]> currentVoteResult)[0];
            if (!currentVote) {
                await this.db.execute('insert into comment_votes (comment_id, voter_id, vote) values (:comment_id, :voter_id, :vote)', {
                    comment_id: commentId,
                    voter_id: userId,
                    vote: vote
                }, connection);
            }
            else if (currentVote.vote !== vote) {
                await this.db.execute('update comment_votes set vote=:vote where vote_id=:vote_id', {
                    vote_id: currentVote.vote_id,
                    vote: vote
                }, connection);
            }

            let ratingResult = await this.db.execute('select sum(vote) rating from comment_votes where comment_id=:comment_id', {
                comment_id: commentId
            }, connection);
            let rating = ratingResult[0].rating || 0;

            await this.db.execute('update comments set rating=:rating where comment_id=:comment_id', {
                rating: rating,
                comment_id: commentId
            }, connection);

            await this.db.commit(connection);

            return rating;
        }
        catch {
            await this.db.rollback(connection);
        }
    }

    async userVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        let connection = await this.db.beginTransaction();
        try {
            let currentVoteResult = await this.db.execute('select * from user_karma where user_id=:user_id and voter_id=:voter_id', {
                user_id: toUserId,
                voter_id: voterId
            }, connection);

            let currentVote = (<UserVoteRaw[]> currentVoteResult)[0];
            if (!currentVote) {
                await this.db.execute('insert into user_karma (user_id, voter_id, vote) values (:user_id, :voter_id, :vote)', {
                    user_id: toUserId,
                    voter_id: voterId,
                    vote: vote
                }, connection);
            }
            else if (currentVote.vote !== vote) {
                await this.db.execute('update user_karma set vote=:vote where vote_id=:vote_id', {
                    vote_id: currentVote.vote_id,
                    vote: vote
                }, connection);
            }

            let ratingResult = await this.db.execute('select sum(vote) rating from user_karma where user_id=:user_id', {
                user_id: toUserId
            }, connection);
            let rating = ratingResult[0].rating || 0;

            await this.db.execute('update users set karma=:karma where user_id=:user_id', {
                karma: rating,
                user_id: toUserId
            }, connection);

            await this.db.commit(connection);

            return rating;
        }
        catch {
            await this.db.rollback(connection);
        }
    }
}
