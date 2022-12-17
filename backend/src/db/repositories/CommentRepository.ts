import DB from '../DB';
import {CommentRaw, CommentRawWithUserData} from '../types/PostRaw';
import CodeError from '../../CodeError';
import {ResultSetHeader} from 'mysql2';

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

    async getComments(commentIds: number[]): Promise<CommentRaw[] | undefined> {
        return await this.db.fetchAll(`select * from comments where comment_id in (?)`, [commentIds]);
    }

    async getCommentWithUserData(forUserId: number, commentId: number): Promise<CommentRawWithUserData | undefined> {
        return await this.db.fetchOne<CommentRaw>(`select c.*, v.vote from comments c left join comment_votes v on (v.comment_id = c.comment_id and v.voter_id = :forUserId) where c.comment_id=:commentId`, {
            commentId,
            forUserId
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

    async getUserComments(userId: number, forUserId: number, filter: string, page: number, perPage: number): Promise<CommentRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;
        const query = `
                select c.*, v.vote
                    from comments c
                      left join comment_votes v on (v.comment_id = c.comment_id and v.voter_id = :for_user_id)
                    where
                      c.author_id = :user_id and c.deleted = 0 ${filter ? ' and c.source like :filter ' : ''}
                    order by c.created_at desc
                    limit :limit_from, :limit_count
            `;
          const params = {
              user_id: userId,
              for_user_id: forUserId,
              limit_from: limitFrom,
              limit_count: perPage
          };
        if (filter) {
            params['filter'] = '%' + filter + '%';
        }
        return await this.db.query(query, params);
    }

    async getLastUserComment(userId: number): Promise<CommentRaw | undefined> {
        return await this.db.fetchOne<CommentRaw>('select * from comments where author_id=:user_id order by created_at desc limit 1', {
            user_id: userId
        });
    }

    async getUserCommentsTotal(userId: number, filter: string): Promise<number> {
        const query = `select count(*) cnt from comments where author_id = ? and deleted = 0 ${filter ? '  and source like ? ' : ''}`;
        const params: Array<number | string> = [userId];
        if (filter) {
            params.push('%' + filter + '%');
        }
        return this.db.fetchOne<{ cnt: string }>(query, params).then((res) => parseInt(res.cnt || '0'));
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, source: string, language: string, html: string): Promise<CommentRaw> {
        return await this.db.inTransaction(async conn => {
            const siteResult = await conn.fetchOne<{site_id: number}>('select site_id from posts where post_id=:post_id', { post_id: postId });

            if (!siteResult) {
                throw new CodeError('no-post', 'Post not found');
            }

            const commentId = await conn.insert('comments', {
                site_id: siteResult.site_id,
                post_id: postId,
                parent_comment_id: parentCommentId,
                author_id: userId,
                source: source,
                language: language,
                html: html
            });

            const contentSourceId = await conn.insert('content_source', {
                ref_type: 'comment',
                ref_id: commentId,
                author_id: userId,
                source
            });

            await conn.query('update comments set content_source_id=:contentSourceId where comment_id=:commentId', {
                commentId,
                contentSourceId
            });

            await conn.query(`update posts p set comments=(select count(*) from comments c where c.post_id = p.post_id), last_comment_id=:last_comment_id, commented_at=now() where p.post_id=:post_id`, {
                post_id: postId,
                last_comment_id: commentId
            });

            const comment = await conn.fetchOne<CommentRaw>(`select * from comments where comment_id = :commentId`, {
                commentId
            });

            if (!comment) {
                throw new CodeError('unknown', 'Could not select comment');
            }

            return comment;
        });
    }

    async updateCommentText(updateByUserId: number, commentId: number, source: string, language: string, html: string, comment?: string): Promise<boolean> {
        return await this.db.inTransaction(async (conn) => {
            const originalComment = await conn.fetchOne<CommentRaw>(`select * from comments where comment_id = :commentId`, {
                commentId
            });

            if (!originalComment) {
                throw new CodeError('unknown', 'Could not select comment');
            }

            const contentSourceId = await conn.insert('content_source', {
                ref_type: 'comment',
                ref_id: commentId,
                author_id: updateByUserId,
                source,
                comment
            });

            const editFlag = 1;

            const result = await conn.query<ResultSetHeader>(
                `update comments
                 set source=:source,
                     html=:html,
                     content_source_id=:contentSourceId,
                     edit_flag=:editFlag,
                     language=:language
                 where comment_id = :commentId`, {
                commentId,
                source,
                html,
                contentSourceId,
                editFlag,
                language
            });

            if (!result.changedRows) {
                throw new CodeError('unknown', 'Could not update comment');
            }

            return true;
        });
    }
}
