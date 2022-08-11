import DB from '../DB';

export type VoteWithUsername = {
    vote: number;
    username: string;
    userId: number;
    voterId: number;
};

export type UserRatingOnSubsite = {
    site_id: number;
    site_name: string;
    subdomain: string;
    comment_rating: number;
    post_rating: number;
};

export default class VoteRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getUserVote(userId: number, byUserId: number): Promise<number> {
        const voteResult = await this.db.fetchOne<{ vote: number }>(
            'select vote from user_karma where user_id=:user_id and voter_id=:voter_id', {
                user_id: userId,
                voter_id: byUserId
            });

        return voteResult?.vote || 0;
    }

    private async setVotes(entityId: number, vote: number, userId: number,
                           comments: boolean): Promise<number> {

        const entityField = comments ? 'comment_id' : 'post_id';
        const entityVotesTable = comments ? 'comment_votes' : 'post_votes';
        const entityTable = comments ? 'comments' : 'posts';
        const userSiteRatingField = comments ? 'comment_rating' : 'post_rating';


        const [entitySite, authorId] = await this.db.fetchOne<{
            site_id: string, author_id: string
        }>(`select site_id, author_id
                from ${entityTable}
                where ${entityField} = :entity_id`, {
            entity_id: entityId
        }).then(res => [parseInt(res.site_id), parseInt(res.author_id)]);

        await this.db.query(`insert ignore into ${entityVotesTable} ( ${entityField}, voter_id, vote ) values ( :entity_id, :voter_id, 0 )`, {
            entity_id: entityId,
            voter_id: userId,
        });

        await this.db.query(`insert ignore into user_site_rating (user_id, site_id, ${userSiteRatingField} ) values ( :user_id, :site_id, 0 )`, {
            user_id: authorId,
            site_id: entitySite,
        });

        return await this.db.inTransaction(async conn => {
            // Important! transaction must start with locking the most "coarse" table first (entity table)
            // to prevent deadlocks
            // tricky: related tables (entity_votes), are implicitly locking records in the entity table
            const prevRating = await conn.fetchOne<{ rating: string; }>(
                `select rating
                 from ${entityTable}
                 where ${entityField} = :entity_id
                     FOR UPDATE /* locks the row */`, {
                    entity_id: entityId
                }).then(res => Number(res.rating || 0));

            const prevVote = await conn.fetchOne<{ vote: string; }>(
                `select vote
                 from ${entityVotesTable}
                 where ${entityField} = :entity_id
                   and voter_id = :voter_id
                     FOR UPDATE` /* Locks the row, or waits for the lock */, {
                    entity_id: entityId,
                    voter_id: userId
                }).then(res => Number(res.vote || 0));

            if (prevVote === vote) {
                return prevRating;
            }

            await conn.query(
                `update ${entityVotesTable}
                 set vote=:vote
                 where ${entityField} = :entity_id
                   and voter_id = :voter_id
                   and vote = :prev_vote`, {
                    entity_id: entityId,
                    voter_id: userId,
                    vote: vote,
                    prev_vote: prevVote
                });

            await conn.query(
                `update ${entityTable}
                 set rating=rating + :delta
                 where ${entityField} = :entity_id`, {
                    entity_id: entityId,
                    delta: vote - prevVote
                });

            // lock the row to prevent concurrent updates
            await conn.query(
                `select ${userSiteRatingField}
                 from user_site_rating
                 where user_id = :user_id
                   and site_id = :site_id
                     FOR UPDATE` /*locks the row*/, {
                    user_id: authorId,
                    site_id: entitySite
                });

            await conn.query(`update user_site_rating
                    set ${userSiteRatingField}=${userSiteRatingField} + :delta
                    where user_id = :user_id
                        and site_id = :site_id`, {
                    user_id: authorId,
                    site_id: entitySite,
                    delta: vote - prevVote
                });

            return prevRating + vote - prevVote;
        });
    }

    async postSetVote(postId: number, vote: number, userId: number): Promise<number> {
        return this.setVotes(postId, vote, userId, false);
    }

    async commentSetVote(commentId: number, vote: number, userId: number): Promise<number> {
        return this.setVotes(commentId, vote, userId, true);
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
        return await this.db.fetchAll(`select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from post_votes v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.post_id = :post_id
                                       order by voted_at desc`, {
            post_id: postId
        });
    }

    async getCommentVotes(commentId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll(`select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from comment_votes v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.comment_id = :comment_id
                                       order by voted_at desc`, {
            comment_id: commentId
        });
    }

    /**
     * Returns votes FOR a user (votes made by other users)
     * @param userId for whom to get votes
     */
    async getUserVotes(userId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll(`select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from user_karma v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.user_id = :user_id
                                       order by voted_at desc`, {
            user_id: userId
        });
    }

    /**
     * Returns votes BY a user (votes FOR other users).
     * @param userId whose votes to get
     */
    async getVotesByUser(userId: number): Promise<VoteWithUsername[]> {
        return await this.db.fetchAll(`select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from user_karma v
                                                join users u on (v.user_id = u.user_id)
                                       where v.voter_id = :user_id
                                       order by voted_at desc`, {
            user_id: userId
        });
    }

    async getUserRatingOnSubsites(userId: number): Promise<UserRatingOnSubsite[]> {
        return await this.db.fetchAll(
            `select usr.site_id as site_id, comment_rating, post_rating, s.name as site_name, subdomain
             from user_site_rating usr
                      left join sites s on (usr.site_id = s.site_id)
             where user_id = :user_id`, {
                user_id: userId
            });
    }
}
