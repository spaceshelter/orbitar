import DB from '../DB';
import PostManager from './PostManager';

export default class VoteManager {
    private db: DB
    private postManager: PostManager;

    constructor(db: DB, postManager: PostManager) {
        this.db = db;
        this.postManager = postManager;
    }

    async postVote(postId: number, vote: number, userId: number): Promise<number> {
        return await this.db.beginTransaction(async conn => {
            try {
                await this.db.query('insert into post_votes (post_id, voter_id, vote) values (:post_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                    post_id: postId,
                    voter_id: userId,
                    vote: vote
                }, conn);

                let ratingResult = await this.db.fetchOne<{ rating: number }>('select sum(vote) rating from post_votes where post_id=:post_id', {
                    post_id: postId
                }, conn);
                let rating = ratingResult.rating || 0;

                await this.db.query('update posts set rating=:rating where post_id=:post_id', {
                    rating: rating,
                    post_id: postId
                }, conn);

                await conn.commit();

                return rating;
            }
            catch (err) {
                await conn.rollback();
                throw err;
            }
        });
    }

    async commentVote(commentId: number, vote: number, userId: number): Promise<number> {
        return await this.db.beginTransaction(async conn => {
            try {
                await this.db.query('insert into comment_votes (comment_id, voter_id, vote) values (:comment_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                    comment_id: commentId,
                    voter_id: userId,
                    vote: vote
                }, conn);

                let ratingResult = await this.db.fetchOne<{ rating: number }>('select sum(vote) rating from comment_votes where comment_id=:comment_id', {
                    comment_id: commentId
                }, conn);
                let rating = ratingResult.rating || 0;

                await this.db.query('update comments set rating=:rating where comment_id=:comment_id', {
                    rating: rating,
                    comment_id: commentId
                }, conn);

                await conn.commit();

                return rating;
            }
            catch (err) {
                await conn.rollback();
                throw err;
            }
        });
    }

    async userVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        return await this.db.beginTransaction(async conn => {
            try {
                await this.db.query('insert into user_karma (user_id, voter_id, vote) values (:user_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                    user_id: toUserId,
                    voter_id: voterId,
                    vote: vote
                }, conn);

                let ratingResult = await this.db.fetchOne<{ rating: number }>('select sum(vote) rating from user_karma where user_id=:user_id', {
                    user_id: toUserId
                }, conn);
                let rating = ratingResult.rating || 0;

                await this.db.query('update users set karma=:karma where user_id=:user_id', {
                    karma: rating,
                    user_id: toUserId
                }, conn);

                await conn.commit();

                return rating;
            }
            catch (err) {
                await conn.rollback();
                throw err;
            }
        });
    }
}
