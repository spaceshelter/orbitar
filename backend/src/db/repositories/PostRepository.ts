import DB from '../DB';
import {PostRaw, PostRawWithUserData} from '../types/PostRaw';
import {OkPacket} from 'mysql2';
import CodeError from '../../CodeError';

export default class PostRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getPostWithUserData(postId: number, forUserId: number): Promise<PostRawWithUserData | undefined> {
        return await this.db.fetchOne<PostRawWithUserData>(`
            select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch
            from posts p
                left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                left join user_bookmarks b on (b.post_id = p.post_id and b.user_id=:user_id)
            where p.post_id=:post_id
        `, {
            post_id: postId,
            user_id: forUserId
        });
    }

    async getPost(postId: number): Promise<PostRaw | undefined> {
        return await this.db.fetchOne<PostRaw>('select * from posts where post_id=:post_id', {post_id: postId});
    }

    async getPostsTotal(siteId: number): Promise<number> {
        const result = await this.db.query(`select count(*) cnt from posts where site_id=:site_id`, {site_id: siteId});
        if (!result || !result[0]) {
            return 0;
        }

        return result[0].cnt;
    }

    async getPosts(siteId: number, forUserId: number, page: number, perPage: number): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
                select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch
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

    async getPostsByUser(userId: number, forUserId: number, page: number, perPage: number): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
                select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch
                from posts p
                         left join post_votes v on (v.post_id = p.post_id and v.voter_id = :for_user_id)
                         left join user_bookmarks b on (b.post_id = p.post_id and b.user_id = :for_user_id)
                where p.author_id = :user_id
                order by created_at desc
                    limit :limit_from, :limit_count
            `,
            {
                user_id: userId,
                for_user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
    }

    async getPostsByUserTotal(userId: number): Promise<number> {
        const result = await this.db.fetchOne<{ cnt: string }>(`select count(*) as cnt from posts where author_id = :user_id`, {user_id: userId});
        if (!result) {
            return 0;
        }
        return parseInt(result.cnt || '');
    }

    async getAllPostsTotal(): Promise<number> {
        const result = await this.db.fetchOne<{ cnt: string }>(`select count(*) cnt from posts`, {});
        if (!result) {
            return 0;
        }
        return parseInt(result.cnt || '');
    }

    async getAllPosts(forUserId: number, page: number, perPage: number): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
            select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch, (p.comments - b.read_comments) cnt
            from
                posts p
                left join user_bookmarks b on (p.post_id = b.post_id)
                left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
            order by
                b.post_updated_at desc
            limit
                :limit_from,:limit_count
            `,
            {
                user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
    }

    async getWatchPostsTotal(forUserId: number, all = false): Promise<number> {
        const result = await this.db.fetchOne<{ cnt: string }>(`
            select count(*) cnt from (
                select p.comments,b.read_comments
                from
                    user_bookmarks b
                    join posts p on (p.post_id = b.post_id) 
                where
                    b.user_id = :user_id
                    and watch = 1
                ${all ? '' : 'having (p.comments - b.read_comments) > 0'}
            ) t
        `, {
            user_id: forUserId
        });
        if (!result) {
            return 0;
        }
        return parseInt(result.cnt || '');
    }

    async getWatchPosts(forUserId: number, page: number, perPage: number, all = false): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
            select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch, (p.comments - b.read_comments) cnt
            from
                user_bookmarks b
                join posts p on (p.post_id = b.post_id) 
                left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
            where
                b.user_id = :user_id
                and watch = 1
            ${all ? '' : 'having cnt > 0'}
            order by
                b.post_updated_at desc
            limit
                :limit_from,:limit_count
            `,
            {
                user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
    }

    async createPost(siteId: number, userId: number, title: string, source: string, html: string): Promise<PostRaw> {
        const postInsertResult: OkPacket =
            await this.db.query('insert into posts (site_id, author_id, title, source, html) values(:siteId, :userId, :title, :source, :html)',
                {siteId, userId, title, source, html});
        const postInsertId = postInsertResult.insertId;
        if (!postInsertId) {
            throw new CodeError('unknown', 'Could not insert post');
        }

        const post = this.getPost(postInsertId);
        if (!post) {
            throw new CodeError('unknown', 'Could not select post');
        }

        return post;
    }

    async getSitePostUpdateDates(forUserId: number, siteId: number, afterPostId: number, limit: number): Promise<{ post_id: number, commented_at: Date }[]> {
        return await this.db.fetchAll(`
                    select p.post_id, p.commented_at
                    from posts p 
                    where
                        p.site_id=:site_id and
                        p.post_id>:last_post_id 
                    order by
                        post_id
                    limit
                        :limit
                `,
            {
                site_id: siteId,
                user_id: forUserId,
                last_post_id: afterPostId,
                limit: limit
            });
    }
}
