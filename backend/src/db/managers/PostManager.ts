import DB from '../DB';
import {CommentRaw, PostRaw} from '../types/PostRaw';
import {OkPacket} from 'mysql2';
import CodeError from '../../CodeError';
import {BookmarkRaw} from '../types/BookmarkRaw';

export type PostRawWithUserData = PostRaw & {
    vote?: number;
    bookmark?: number;
    read_comments?: number;
};
export type CommentRawWithUserData = CommentRaw & {
    vote?: number;
    is_new?: boolean;
};

export default class PostManager {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getRaw(postId: number, forUserId?: number): Promise<PostRaw | PostRawWithUserData | undefined> {
        let result;
        if (forUserId) {
            result = await this.db.query(`
                select p.*, v.vote, b.read_comments, b.bookmark
                from posts p
                    left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                    left join user_bookmarks b on (b.post_id = p.post_id and b.user_id=:user_id)
                where p.post_id=:post_id
            `, {
                post_id: postId,
                user_id: forUserId
            });
        }
        else {
            result = await this.db.query('select * from posts where post_id=:post_id', {post_id: postId});
        }

        let row = (<PostRaw> result)[0];
        if (!row) {
            return;
        }

        return row;
    }

    async getTotal(siteId: number): Promise<number> {
        let result = await this.db.query(`select count(*) cnt from posts where site_id=:site_id`, {site_id: siteId});
        if (!result || !result[0]) {
            return 0;
        }

        return result[0].cnt;
    }

    async getAllRaw(siteId: number, forUserId: number, page: number, perPage: number): Promise<PostRawWithUserData[]> {
        let limitFrom = (page - 1) * perPage;

        return await this.db.query(`
                select p.*, v.vote, b.read_comments, b.bookmark
                from posts p 
                    left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                    left join user_bookmarks b on (b.post_id = p.post_id and b.user_id=:user_id)
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
    }

    async getAllCommentsRaw(postId: number, forUserId: number): Promise<CommentRawWithUserData[]> {
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

    async createPost(siteId: number, userId: number, title: string, source: string, html: string): Promise<PostRaw> {
        let postInsertResult: OkPacket =
            await this.db.query('insert into posts (site_id, author_id, title, source, html) values(:siteId, :userId, :title, :source, :html)',
                {siteId, userId, title, source, html})
        let postInsertId = postInsertResult.insertId
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

        let commentInsertResult: OkPacket = await this.db.query(`
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

        let commentInsertId = commentInsertResult.insertId;
        if (!commentInsertId) {
            throw new CodeError('unknown', 'Could not insert comment');
        }

        await this.db.query(`update posts p set comments=(select count(*) from comments c where c.post_id = p.post_id), last_comment_id=:last_comment_id, commented_at=now() where p.post_id=:post_id`, {
            post_id: postId,
            last_comment_id: commentInsertId
        });

        let commentResult:CommentRaw[] = await this.db.query(`select * from comments where comment_id = :comment_id`, { comment_id: commentInsertId });
        return commentResult[0];
    }

    async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number) {
        await this.db.beginTransaction(async conn => {
            try {
                const bookmark = await this.db.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
                    post_id: postId,
                    user_id: userId
                }, conn);

                if (!bookmark) {
                    await this.db.query('insert into user_bookmarks (post_id, user_id, read_comments, last_comment_id) values(:post_id, :user_id, :read_comments, :last_comment_id)', {
                        post_id: postId,
                        user_id: userId,
                        read_comments: readComments,
                        last_comment_id: lastCommentId
                    }, conn);
                }
                else {
                    await this.db.query('update user_bookmarks set read_comments=:read_comments, last_comment_id=:last_comment_id where bookmark_id=:bookmark_id', {
                        read_comments: readComments,
                        last_comment_id: lastCommentId ?? bookmark.last_comment_id,
                        bookmark_id: bookmark.bookmark_id
                    }, conn);
                }

                await conn.commit();
            }
            catch {
                await conn.rollback();
            }
        });
    }

    async getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
        return await this.db.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
            post_id: postId,
            user_id: userId
        });
    }

    async setBookmark(postId: number, userId: number, bookmarked: boolean) {
        await this.db.beginTransaction(async conn => {
            try {
                const bookmark = await this.db.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
                    post_id: postId,
                    user_id: userId
                }, conn);

                if (!bookmark) {
                    await this.db.query('insert into user_bookmarks (post_id, user_id, bookmark) values(:post_id, :user_id, :bookmark)', {
                        post_id: postId,
                        user_id: userId,
                        bookmark: bookmarked ? 1 : 0
                    }, conn);
                }
                else {
                    await this.db.query('update user_bookmarks set read_comments=:read_comments where bookmark=:bookmark', {
                        bookmark: bookmarked ? 1 : 0,
                        bookmark_id: bookmark.bookmark_id
                    }, conn);
                }

                await conn.commit();
            }
            catch {
                await conn.rollback();
            }
        });
    }
}
