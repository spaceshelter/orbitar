import DB from '../DB';
import {PostBareBonesRaw, PostRaw, PostRawWithUserData} from '../types/PostRaw';
import CodeError from '../../CodeError';
import {ResultSetHeader} from 'mysql2';
import {ContentSourceRaw} from '../types/ContentSourceRaw';
import {FeedSorting} from '../../api/types/entities/common';

export default class PostRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    /**
     * fetch min created_at and min commented_at
     */
    getMinPostDate(): Promise<Date> {
        return this.db.fetchOne<{min_date: Date}>(`
            SELECT LEAST(MIN(created_at), MIN(commented_at)) AS min_date
            FROM posts
        `).then(_ => _?.min_date);
    }

    async getPostIdsAndSites(sincePostId: number, limit: number): Promise<PostBareBonesRaw[]> {
        return await this.db.query(`
            select post_id, site_id, created_at, commented_at
            from posts
            where post_id > :since_post_id
            order by post_id asc
            limit :limit
        `, {since_post_id: sincePostId, limit: limit});
    }

    async getPostsWithUserData(postId: number[], forUserId: number): Promise<PostRawWithUserData[]> {
        if (!postId.length) {
            return [];
        }
        return this.db.fetchAll<PostRawWithUserData>(`
            select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch
            from posts p
                left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                left join user_bookmarks b on (b.post_id = p.post_id and b.user_id=:user_id)
            where p.post_id in (:post_ids)
        `, {
            post_ids: postId,
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

    async getPosts(siteId: number, forUserId: number, page: number, perPage: number, sorting: FeedSorting): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
                select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch
                from posts p 
                    left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
                    left join user_bookmarks b on (b.post_id = p.post_id and b.user_id=:user_id)
                where
                    site_id=:site_id
                order by
                    ${sorting === FeedSorting.postCommentedAt ? 'commented_at' : 'created_at'} desc
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

    async getAllPosts(forUserId: number, page: number, perPage: number, sorting: FeedSorting): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perPage;

        return await this.db.query(`
            select p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id, b.watch, (p.comments - b.read_comments) cnt
            from
                posts p
                left join user_bookmarks b on (p.post_id = b.post_id and b.user_id=:user_id)
                left join post_votes v on (v.post_id = p.post_id and v.voter_id=:user_id)
            order by
                p.${sorting === FeedSorting.postCommentedAt ? 'commented_at' : 'created_at'} desc
            limit
                :limit_from,:limit_count
            `,
            {
                user_id: forUserId,
                limit_from: limitFrom,
                limit_count: perPage
            });
    }

    getLastUserPost(userId: number): Promise<PostRaw | undefined> {
        return this.db.fetchOne<PostRawWithUserData>('select * from posts where author_id=:user_id order by created_at desc limit 1', {user_id: userId});
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

    async createPost(siteId: number, userId: number, title: string, source: string, language: string, html: string): Promise<PostRaw> {
        return await this.db.inTransaction(async (db) => {
            const postId = await db.insert('posts', {
                site_id: siteId,
                author_id: userId,
                title,
                source,
                language,
                html
            });

            const contentSourceId = await db.insert('content_source', {
                ref_type: 'post',
                ref_id: postId,
                author_id: userId,
                title,
                source
            });

            await db.query('update posts set content_source_id=:contentSourceId where post_id=:postId', {
                postId,
                contentSourceId
            });

            const post = await db.fetchOne<PostRaw>('select * from posts where post_id=:postId', {
                postId
            });

            if (!post) {
                console.log('POST', post, postId);
                throw new CodeError('unknown', 'Could not select post');
            }

            return post;
        });
    }

    async getSitePostUpdateDates(forUserId: number, siteId: number, afterPostId: number, limit: number): Promise<{ post_id: number, commented_at: Date, created_at: Date }[]> {
        return await this.db.fetchAll(`
                    select p.post_id, p.commented_at, p.created_at
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

    async updatePostText(updateByUserId: number, postId: number, title: string, source: string, language:string, html: string, comment?: string): Promise<boolean> {
        return await this.db.inTransaction(async (conn) => {
            const originalPost = await conn.fetchOne<PostRaw>(`select * from posts where post_id = :postId`, {
                postId
            });

            if (!originalPost) {
                throw new CodeError('unknown', 'Could not select post');
            }

            const contentSourceId = await conn.insert('content_source', {
                ref_type: 'post',
                ref_id: postId,
                author_id: updateByUserId,
                title,
                source,
                comment
            });

            const editFlag = 1;

            const result = await conn.query<ResultSetHeader>(
                `update posts
                 set title=:title,
                     source=:source,
                     html=:html,
                     content_source_id=:contentSourceId,
                     edit_flag=:editFlag,
                     language=:language
                 where post_id = :postId`, {
                title: title || '',
                postId,
                source,
                html,
                contentSourceId,
                editFlag,
                language
            });

            if (!result.changedRows) {
                throw new CodeError('unknown', 'Could not update post');
            }

            return true;
        });
    }

    async getLatestContentSource(refId: number, refType: 'post' | 'comment'): Promise<ContentSourceRaw | undefined> {
        return await this.db.fetchOne<ContentSourceRaw>(`select *
                                                         from content_source
                                                         where ref_id = :refId
                                                           and ref_type = :refType
                                                         order by content_source_id desc limit 1`, {
            refId,
            refType
        });
    }

    async getContentSources(refId: number, refType: string): Promise<ContentSourceRaw[]> {
        return await this.db.fetchAll<ContentSourceRaw>('select * from content_source where ref_id=:refId and ref_type=:refType order by content_source_id desc', {
            refId, refType
        });
    }
}
