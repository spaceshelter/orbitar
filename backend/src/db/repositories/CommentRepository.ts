import DB from '../DB';
import {CommentRaw, CommentRawWithUserData} from '../types/PostRaw';
import CodeError from '../../CodeError';
import {OkPacket} from 'mysql2';

export default class CommentRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getComment(commentId: number): Promise<CommentRaw | undefined> {
        return await this.db.fetchOne<CommentRaw>('select * from comments where comment_id=:comment_id', {
            comment_id: commentId
        });
    }

    async getPostComments(postId: number, forUserId: number): Promise<CommentRawWithUserData[]> {
        return await this.db.query(`
                select c.*, v.vote
                    from comments c
                      left join comment_votes v on (v.comment_id = c.comment_id and v.voter_id = :user_id)
                    where
                      c.post_id = :post_id
                    order by
                      c.parent_comment_id, c.comment_id
            `,
            {
                post_id: postId,
                user_id: forUserId
            });
    }

    async getUserComments(userId: number, forUserId: number, page: number, perPage: number): Promise<CommentRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;
        return await this.db.query(`
                select c.*, v.vote
                    from comments c
                      left join comment_votes v on (v.comment_id = c.comment_id and v.voter_id = :for_user_id)
                    where
                      c.author_id = :user_id and c.deleted = 0
                    order by c.created_at desc
                    limit :limit_from, :limit_count
            `,
            {
                user_id: userId,
                for_user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
    }

    async getUserCommentsTotal(userId: number): Promise<number> {
        return this.db.fetchOne<any>('select count(*) cnt from comments where author_id = :user_id and deleted = 0', {
            user_id: userId
        }).then((res) => parseInt(res.cnt || '0'));
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, source: string, html: string): Promise<CommentRaw> {
        return await this.db.inTransaction(async conn => {
            const siteResult = await conn.fetchOne<{site_id: number}>('select site_id from posts where post_id=:post_id', { post_id: postId });

            if (!siteResult) {
                throw new CodeError('no-post', 'Post not found');
            }

            const commentInsertResult: OkPacket = await conn.query(`
                insert into comments
                    (site_id, post_id, parent_comment_id, author_id, source, html)
                    values(:site_id, :post_id, :parent_comment_id, :author_id, :source, :html)
            `, {
                site_id: siteResult.site_id,
                post_id: postId,
                parent_comment_id: parentCommentId,
                author_id: userId,
                source: source,
                html: html
            });

            const commentInsertId = commentInsertResult.insertId;
            if (!commentInsertId) {
                throw new CodeError('unknown', 'Could not insert comment');
            }

            await conn.query(`update posts p set comments=(select count(*) from comments c where c.post_id = p.post_id), last_comment_id=:last_comment_id, commented_at=now() where p.post_id=:post_id`, {
                post_id: postId,
                last_comment_id: commentInsertId
            });

            const commentResult:CommentRaw[] = await conn.query(`select * from comments where comment_id = :comment_id`, { comment_id: commentInsertId });
            return commentResult[0];
        });
    }
}
