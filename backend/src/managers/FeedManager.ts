import {RedisClientType} from 'redis';
import PostRepository from '../db/repositories/PostRepository';
import {PostRawWithUserData} from '../db/types/PostRaw';
import UserRepository from '../db/repositories/UserRepository';
import CodeError from '../CodeError';
import ExclusiveTask, {TaskState} from '../utils/ExclusiveTask';
import BookmarkRepository from '../db/repositories/BookmarkRepository';
import {PostInfo} from './types/PostInfo';
import {ContentFormat} from './types/common';
import {SiteInfo} from './types/SiteInfo';
import SiteManager from './SiteManager';
import UserManager from './UserManager';
import {getFeedSortingBySite} from '../db/utils/Feed';
import {FeedSorting, MainSubdomain} from '../api/types/entities/common';

export default class FeedManager {
    private readonly bookmarkRepository: BookmarkRepository;
    private readonly postRepository: PostRepository;
    private readonly userRepository: UserRepository;
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;
    private readonly redis: RedisClientType;

    constructor(bookmarkRepository: BookmarkRepository, postRepository: PostRepository, userRepository: UserRepository, siteManager: SiteManager, userManager: UserManager, redis: RedisClientType) {
        this.bookmarkRepository = bookmarkRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.redis = redis;
    }

    async getSubscriptionFeed(forUserId: number, page: number, perpage: number, format: ContentFormat): Promise<PostInfo[]> {
        const limitFrom = (page - 1) * perpage;

        // check if fanned out
        const result = await this.redis.get(`subscriptions:${forUserId}:fanned`);
        if (!result) {
            // pull if not fanned out yet
            await this.pullSubscriptionsFeed(forUserId);
        }

        const user = await this.userManager.getById(forUserId);
        const sortingType = getFeedSortingBySite(user.feedSortingSettings, MainSubdomain);

        // get post ids from redis
        const redisFeedName = sortingType === FeedSorting.postCommentedAt ? `subscriptions:${forUserId}` : `subscriptions:${forUserId}:created_at`;
        const postIds = await this.redis.zRange(redisFeedName, '+inf', 0, { REV: true, BY: 'SCORE', LIMIT: { offset: limitFrom, count: perpage } });

        const posts: PostRawWithUserData[] = [];
        for (const postId of postIds) {
            const post = await this.postRepository.getPostWithUserData(parseInt(postId), forUserId);
            posts.push(post);
        }

        return await this.convertRawPost(forUserId, posts, format);
    }

    async getSubscriptionsTotal(forUserId: number): Promise<number> {
        return await this.redis.zCount(`subscriptions:${forUserId}`, 0, '+inf');
    }

    async getAllPosts(forUserId: number, page: number, perpage: number, format: ContentFormat, sortBy: FeedSorting): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getAllPosts(forUserId, page, perpage, sortBy);
        return this.convertRawPost(forUserId, rawPosts, format);
    }

    async getAllPostsTotal(): Promise<number> {
        return await this.postRepository.getAllPostsTotal();
    }

    async getWatchFeed(forUserId: number, page: number, perpage: number, all = false, format: ContentFormat = 'html', sortBy: FeedSorting): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getWatchPosts(forUserId, page, perpage, all, sortBy);
        return await this.convertRawPost(forUserId, rawPosts, format);
    }

    async getWatchTotal(forUserId: number, all = false): Promise<number> {
        return await this.postRepository.getWatchPostsTotal(forUserId, all);
    }

    async getSiteFeed(forUserId: number, siteId: number, page: number, perpage: number, format: ContentFormat, sortBy: FeedSorting): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getPosts(siteId, forUserId, page, perpage, sortBy);
        return this.convertRawPost(forUserId, rawPosts, format);
    }

    async getSiteTotal(siteId: number): Promise<number> {
        return await this.postRepository.getPostsTotal(siteId);
    }

    async pullSubscriptionsFeed(forUserId: number) {
        // TODO: check for simultaneous pulls

        // set fanout flag
        await this.redis.set(`subscriptions:${forUserId}:fanned`, 'true');

        const sites = await this.userRepository.getUserMainSubscriptions(forUserId);

        for (const site of sites) {
            await this.siteFanOut(forUserId, site.site_id);
        }
    }

    private postFanOutTasks: Record<number, ExclusiveTask<boolean, never>> = {};
    async postFanOut(postId: number) {
        let task = this.postFanOutTasks[postId];
        if (task) {
            await task.run();
            return;
        }

        task = new ExclusiveTask<boolean, never>(async (state) => {
            await this.postFanOutRun(postId, state);
            return true;
        });
        this.postFanOutTasks[postId] = task;
        await task.run();
        delete this.postFanOutTasks[postId];
    }

    private async postFanOutRun(postId: number, state: TaskState) {
        // get post data
        const post = await this.postRepository.getPost(postId);
        if (!post) {
            throw new CodeError('fanout-no-post', `Could not load post ${postId}`);
        }

        if (state.cancelled) throw new Error('Fanout cancelled');

        // get all subscribed users
        const strPostId = `${postId}`;
        const users = await this.userRepository.getMainSubscriptionsUsers(post.site_id);

        for (const {user_id} of users) {
            if (state.cancelled) {
                throw new Error('Fanout cancelled');
            }

            const result = await this.redis.exists(`subscriptions:${user_id}:fanned`);
            if (!result) {
                // skip not fanned-out users
                continue;
            }

            // TODO: define and use expire for these values
            await this.redis.zAdd(`subscriptions:${user_id}`, [{ score: post.commented_at.getTime(), value: strPostId }]);
            await this.redis.zAdd(`subscriptions:${user_id}:created_at`, [{ score: post.created_at.getTime(), value: strPostId }]);

            // TODO: use redis for update bookmarks
            await this.bookmarkRepository.setUpdated(postId, user_id, post.commented_at);
        }
    }

    private siteFanOutTasks: Record<string, ExclusiveTask<boolean, never>> = {};
    async siteFanOut(forUserId: number, siteId: number, remove = false) {
        const fanOutId = `${siteId}:${forUserId}`;
        let task = this.siteFanOutTasks[fanOutId];
        if (task) {
            task.cancel().then();
        }

        task = new ExclusiveTask<boolean, never>(async (state) => {
            await this.siteFanOutRun(forUserId, siteId, remove, state);
            return true;
        });
        this.siteFanOutTasks[fanOutId] = task;
        await task.run();
        delete this.siteFanOutTasks[fanOutId];
    }

    async siteFanOutRun(forUserId: number, siteId: number, remove, state: TaskState) {
        // console.log('Fanout site', siteId);
        let posts: { post_id: number, created_at: Date, commented_at: Date }[];
        let last_post_id = 0;
        do {
            posts = await this.postRepository.getSitePostUpdateAndCreateDates(forUserId, siteId, last_post_id, 100);

            if (state.cancelled) {
                throw new Error('Fanout cancelled');
            }

            if (posts.length < 1) {
                break;
            }

            last_post_id = posts[posts.length - 1].post_id;

            if (remove) {
                const redisValues = posts.map(post => `${post.post_id}`);
                await this.redis.zRem(`subscriptions:${forUserId}`, redisValues);
            }
            else {
                let redisValuesSortedByPostCreated = [];
                let redisValuesSortedByPostCommented = [];
                for (let i = 0; i < posts.length; i++) {
                    let post = posts[i];
                    redisValuesSortedByPostCreated.push({
                        score: post.created_at.getTime(),
                        value: post.post_id
                    });
                    redisValuesSortedByPostCommented.push({
                        score: post.commented_at.getTime(),
                        value: post.post_id
                    });
                }
                await this.redis.zAdd(`subscriptions:${forUserId}`, redisValuesSortedByPostCommented);
                await this.redis.zAdd(`subscriptions:${forUserId}:created_at`, redisValuesSortedByPostCreated);
            }
        } while (posts.length > 0);

        // console.log('Fanout complete', siteId);
    }

    async convertRawPost(forUserId: number, rawPosts: PostRawWithUserData[], format: ContentFormat): Promise<PostInfo[]> {
        const siteById: Record<number, SiteInfo> = {};
        const posts: PostInfo[] = [];

        for (const rawPost of rawPosts) {
            let site = siteById[rawPost.site_id];
            if (!site) {
                site = await this.siteManager.getSiteById(rawPost.site_id);
                siteById[rawPost.site_id] = site;
            }

            const post: PostInfo = {
                id: rawPost.post_id,
                site: site ? site.site : '',
                author: rawPost.author_id,
                created: rawPost.created_at,
                title: rawPost.title,
                content: format === 'html' ? rawPost.html : rawPost.source,
                rating: rawPost.rating,
                comments: rawPost.comments,
                newComments: rawPost.read_comments ? Math.max(0, rawPost.comments - rawPost.read_comments) : rawPost.comments,
                bookmark: !!rawPost.bookmark,
                watch: !!rawPost.watch,
                vote: rawPost.vote,
                lastReadCommentId: rawPost.last_read_comment_id,
            };
            if (rawPost.author_id === forUserId) {
                post.canEdit = true;
            }
            if (rawPost.edit_flag) {
                post.editFlag = rawPost.edit_flag;
            }

            posts.push(post);
        }

        return posts;

    }

    async siteSubscribe(userId: number, siteName: string, main: boolean, bookmarks: boolean) {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const siteId = site.id;

        const existingSubscription = await this.siteManager.getSubscription(userId, site.id);
        if (existingSubscription && !!existingSubscription.feed_main === main &&
            !!existingSubscription.feed_bookmarks === bookmarks) {
            return { main, bookmarks };
        }

        await this.siteManager.siteSubscribe(userId, site.id, main, bookmarks);

        // fanout in background
        this.siteFanOut(userId, siteId, !main).then().catch();

        return { main, bookmarks };
    }
}
