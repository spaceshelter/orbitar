import DB from '../DB';
import {CommentRaw, CommentRawWithUserData} from '../types/PostRaw';
import CodeError from '../../CodeError';
import {ResultSetHeader} from 'mysql2';
import {escapePercent} from '../../utils/MySqlUtils';

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
        return await this.db.query(`
            select c.*, v.vote
            from comments c
                     left join comment_votes v on (v.comment_id = c.comment_id and v.voter_id = :for_user_id)
            where
                c.author_id = :user_id
              and c.deleted = 0 ${filter ? ' and c.source like :filter ' : ''}
            order by c.created_at desc
            limit :limit_from, :limit_count
        `, {
            user_id: userId,
            for_user_id: forUserId,
            limit_from: limitFrom,
            limit_count: perPage,
            filter: filter && ('%' + escapePercent(filter) + '%')
        });
    }

    async getLastUserComment(userId: number): Promise<CommentRaw | undefined> {
        return await this.db.fetchOne<CommentRaw>('select * from comments where author_id=:user_id order by created_at desc limit 1', {
            user_id: userId
        });
    }

    async getUserCommentsTotal(userId: number, filter: string): Promise<number> {
        return this.db.fetchOne<{ cnt: string }>(`
            select count(*) cnt 
            from comments 
            where author_id = :user_id and deleted = 0 
            ${filter ? '  and source like :filter ' : ''}`,
            {
                user_id: userId,
                filter: filter && ('%' + escapePercent(filter) + '%')
            }).then((res) => parseInt(res.cnt || '0'));
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, source: string,
                        language: string, html: string, updateCommentedAt = true): Promise<CommentRaw> {
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

            await conn.query(`update posts p set comments=(select count(*) from comments c where c.post_id = p.post_id), 
                   last_comment_id=:last_comment_id
                       ${updateCommentedAt ? ', commented_at=now()' : ''} 
               where p.post_id=:post_id`, {
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

    async updateCommentsHtmlAndParserVersion(batch: { id: number; html: string }[], parserVersion: number) {
        if (!batch.length) {
            return;
        }
        return await this.db.inTransaction(async (conn) => {
            for (const { id, html } of batch) {
                await conn.query<ResultSetHeader>(`
                    update comments
                    set html=:html,
                        parser_version=:parserVersion
                    where comment_id = :id and parser_version < :parserVersion
                `, {
                    id,
                    html,
                    parserVersion
                });
            }
        });
    }

    async updateCommentsParserVersion(commentIds: number[], parserVersion: number) {
        if (!commentIds.length) {
            return;
        }
        return await this.db.query(`
            update comments
            set parser_version=:parserVersion
            where comment_id in (:commentIds)
        `, {
            commentIds,
            parserVersion
        });
    }
}
