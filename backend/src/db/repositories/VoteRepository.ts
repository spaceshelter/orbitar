import DB from '../DB';

export type VoteWithUsername = {
    vote: number;
    username: string;
};

export default class VoteRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getUserVote(userId: number, byUserId: number): Promise<number> {
        const voteResult = await this.db.fetchOne<{vote: number}>('select vote from user_karma where user_id=:user_id and voter_id=:voter_id', {
            user_id: userId,
            voter_id: byUserId
        });

        return voteResult?.vote || 0;
    }

    async postSetVote(postId: number, vote: number, userId: number): Promise<number> {
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into post_votes (post_id, voter_id, vote) values (:post_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                post_id: postId,
                voter_id: userId,
                vote: vote
            });

            const ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from post_votes where post_id=:post_id', {
                post_id: postId
            });
            const rating = Number(ratingResult.rating || 0);

            await conn.query('update posts set rating=:rating where post_id=:post_id', {
                rating: rating,
                post_id: postId
            });

            return rating;
        });
    }

    async commentSetVote(commentId: number, vote: number, userId: number): Promise<number> {
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into comment_votes (comment_id, voter_id, vote) values (:comment_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                comment_id: commentId,
                voter_id: userId,
                vote: vote
            });

            const ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from comment_votes where comment_id=:comment_id', {
                comment_id: commentId
            });
            const rating = Number(ratingResult.rating || 0);

            await conn.query('update comments set rating=:rating where comment_id=:comment_id', {
                rating: rating,
                comment_id: commentId
            });

            return rating;
        });
    }

    async userSetVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        return await this.db.inTransaction(async conn => {
            await conn.query('insert into user_karma (user_id, voter_id, vote) values (:user_id, :voter_id, :vote) on duplicate key update vote=:vote', {
                user_id: toUserId,
                voter_id: voterId,
                vote: vote
            });

            const ratingResult = await conn.fetchOne<{ rating: number }>('select sum(vote) rating from user_karma where user_id=:user_id', {
                user_id: toUserId
            });
            const rating = Number(ratingResult.rating || 0);

            await conn.query('update users set karma=:karma where user_id=:user_id', {
                karma: rating,
                user_id: toUserId
            });

            return rating;
        });
    }

    async getPostVotes(postId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll('select u.username, v.vote from post_votes v join users u on (v.voter_id = u.user_id) where v.post_id=:post_id', {
            post_id: postId
        });
    }

    async getCommentVotes(commentId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll('select u.username, v.vote from comment_votes v join users u on (v.voter_id = u.user_id) where v.comment_id=:comment_id', {
            comment_id: commentId
        });
    }

    async getUserVotes(userId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll('select u.username, v.vote from user_karma v join users u on (v.voter_id = u.user_id) where v.user_id=:user_id', {
            user_id: userId
        });
    }
}
