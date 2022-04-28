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
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into post_votes (post_id, voter_id, vote) values (:post_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                post_id: postId,
                voter_id: userId,
                vote: vote
            });

            let ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from post_votes where post_id=:post_id', {
                post_id: postId
            });
            let rating = Number(ratingResult.rating || 0);

            await conn.query('update posts set rating=:rating where post_id=:post_id', {
                rating: rating,
                post_id: postId
            });

            return rating;
        });
    }

    async commentVote(commentId: number, vote: number, userId: number): Promise<number> {
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into comment_votes (comment_id, voter_id, vote) values (:comment_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                comment_id: commentId,
                voter_id: userId,
                vote: vote
            });

            let ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from comment_votes where comment_id=:comment_id', {
                comment_id: commentId
            });
            let rating = Number(ratingResult.rating || 0);

            await conn.query('update comments set rating=:rating where comment_id=:comment_id', {
                rating: rating,
                comment_id: commentId
            });

            return rating;
        });
    }

    async userVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into user_karma (user_id, voter_id, vote) values (:user_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                user_id: toUserId,
                voter_id: voterId,
                vote: vote
            });

            let ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from user_karma where user_id=:user_id', {
                user_id: toUserId
            });
            let rating = Number(ratingResult.rating || 0);

            await conn.query('update users set karma=:karma where user_id=:user_id', {
                karma: rating,
                user_id: toUserId
            });
            
            return rating;
        });
    }
}
