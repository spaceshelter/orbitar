import {RedisClientType} from 'redis';
import PostRepository from '../repositories/PostRepository';
import {PostRawWithUserData} from '../types/PostRaw';
import UserRepository from '../repositories/UserRepository';
import CodeError from '../../CodeError';
import ExclusiveTask, {TaskState} from '../../utils/ExclusiveTask';
import BookmarkRepository from '../repositories/BookmarkRepository';

export default class FeedManager {
    private readonly redis: RedisClientType;
    private readonly postRepository: PostRepository;
    private readonly userRepository: UserRepository;
    private readonly bookmarkRepository: BookmarkRepository;

    constructor(bookmarkRepository: BookmarkRepository, postRepository: PostRepository, userRepository: UserRepository, redis: RedisClientType) {
        this.bookmarkRepository = bookmarkRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.redis = redis;
    }

    async getSubscriptionFeed(forUserId: number, page: number, perpage: number): Promise<PostRawWithUserData[]> {
        const limitFrom = (page - 1) * perpage;

        // check if fanned out
        const result = await this.redis.get(`subscriptions:${forUserId}:fanned`);
        if (!result) {
            // pull if not fanned out yet
            await this.pullSubscriptionsFeed(forUserId);
        }

        // get post ids from redis
        const postIds = await this.redis.zRange(`subscriptions:${forUserId}`, '+inf', 0, { REV: true, BY: 'SCORE', LIMIT: { offset: limitFrom, count: perpage } });

        const posts: PostRawWithUserData[] = [];
        for (const postId of postIds) {
            const post = await this.postRepository.getPostWithUserData(parseInt(postId), forUserId);
            posts.push(post);
        }

        return posts;
    }

    async getSubscriptionsTotal(forUserId: number): Promise<number> {
        return await this.redis.zCount(`subscriptions:${forUserId}`, 0, '+inf');
    }

    async getWatchFeed(forUserId: number, page: number, perpage: number, all = false): Promise<PostRawWithUserData[]> {
        return await this.postRepository.getWatchPosts(forUserId, page, perpage, all);
    }

    async getWatchTotal(forUserId: number, all = false): Promise<number> {
        return await this.postRepository.getWatchPostsTotal(forUserId, all);
    }


    async getSiteFeed(forUserId: number, siteId: number, page: number, perpage: number): Promise<PostRawWithUserData[]> {
        return await this.postRepository.getPosts(siteId, forUserId, page, perpage);
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

            // console.log(`update subscription for ${user_id}`);
            await this.redis.zAdd(`subscriptions:${user_id}`, [{ score: post.commented_at.getTime(), value: strPostId }]);

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
        let posts: { post_id: number, commented_at: Date }[];
        let last_post_id = 0;
        do {
            posts = await this.postRepository.getSitePostUpdateDates(forUserId, siteId, last_post_id, 100);

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
                const redisValues = posts.map(post => {
                    return {
                        score: post.commented_at.getTime(),
                        value: `${post.post_id}`
                    };
                });
                await this.redis.zAdd(`subscriptions:${forUserId}`, redisValues);
            }
        } while (posts.length > 0);

        // console.log('Fanout complete', siteId);
    }
}
