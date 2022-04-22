import DB from '../DB';
import {CommentRaw, PostRaw} from '../types/PostRaw';
import {OkPacket} from 'mysql2';
import CodeError from '../../CodeError';

export type PostRawWithVote = PostRaw & {
    vote?: number;
};
export type CommentRawWithVote = CommentRaw & {
    vote?: number;
};

export default class PostManager {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getRaw(postId: number, forUserId?: number): Promise<PostRaw | PostRawWithVote | undefined> {
        let result;
        if (forUserId) {
            result = await this.db.execute('select p.*, v.vote from posts p left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id) where p.post_id=:post_id', {
                post_id: postId,
                user_id: forUserId
            });
        }
        else {
            result = await this.db.execute('select * from posts where post_id=:post_id', {post_id: postId});
        }

        let row = (<PostRaw> result)[0];
        if (!row) {
            return;
        }

        return row;
    }

    async getTotal(siteId: number): Promise<number> {
        let result = await this.db.execute(`select count(*) cnt from posts where site_id=:site_id`, {site_id: siteId});
        if (!result || !result[0]) {
            return 0;
        }

        return result[0].cnt;
    }

    async getAllRaw(siteId: number, forUserId: number, page: number, perPage: number): Promise<PostRawWithVote[]> {
        let limitFrom = (page - 1) * perPage;

        let result = await this.db.execute(`
                select p.*, v.vote 
                from posts p 
                    left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                where
                    site_id=:site_id
                order by
                    commented_at desc
                limit :limit_from,:limit_count
            `,
            {
                site_id: siteId,
                user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
        let rows = (<PostRawWithVote[]> result);

        return rows;
    }

    async getAllCommentsRaw(postId: number, forUserId: number): Promise<CommentRawWithVote[]> {

        let result = await this.db.execute(`
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
        let rows = (<CommentRawWithVote[]> result);

        return rows;
    }

    async createPost(siteId: number, userId: number, title: string, source: string, html: string): Promise<PostRaw> {
        let postInsertResult = await this.db.execute('insert into posts (site_id, author_id, title, source, html) values(:siteId, :userId, :title, :source, :html)', {siteId, userId, title, source, html});
        let postInsertId = (<OkPacket> postInsertResult).insertId;
        if (!postInsertId) {
            throw new CodeError('unknown', 'Could not insert post');
        }

        let post = this.getRaw(postInsertId);
        if (!post) {
            throw new CodeError('unknown', 'Could not select post');
        }

        return post;
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, source: string, html: string): Promise<CommentRaw> {
        let rawPost = await this.getRaw(postId);
        if (!rawPost) {
            throw new CodeError('no-post', 'Post not found');
        }

        let commentInsertResult = await this.db.execute(`
            insert into comments
                (site_id, post_id, parent_comment_id, author_id, source, html)
                values(:site_id, :post_id, :parent_comment_id, :author_id, :source, :html)
        `, {
            site_id: rawPost.site_id,
            post_id: postId,
            parent_comment_id: parentCommentId,
            author_id: userId,
            source: source,
            html: html
        });

        let commentInsertId = (<OkPacket> commentInsertResult).insertId;
        if (!commentInsertId) {
            throw new CodeError('unknown', 'Could not insert comment');
        }

        await this.db.execute(`update posts p set comments=(select count(*) from comments c where c.post_id = p.post_id), last_comment_id=:last_comment_id where p.post_id=:post_id`, {
            post_id: postId,
            last_comment_id: commentInsertId
        });

        let commentResult = await this.db.execute(`select * from comments where comment_id = :comment_id`, { comment_id: commentInsertId });
        let commentRaw = (<CommentRaw[]> commentResult)[0];

        return commentRaw;
    }
}
