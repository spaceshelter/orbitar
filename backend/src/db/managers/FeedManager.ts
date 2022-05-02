import {RedisClientType} from 'redis';
import PostRepository from '../repositories/PostRepository';
import {PostRawWithUserData} from '../types/PostRaw';
import UserRepository from '../repositories/UserRepository';
import CodeError from '../../CodeError';

export default class FeedManager {
    private redis: RedisClientType;
    private postRepository: PostRepository;
    private userRepository: UserRepository;

    constructor(postRepository: PostRepository, userRepository: UserRepository, redis: RedisClientType) {
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

    async postFanOut(postId: number) {
        // get post data
        const post = await this.postRepository.getPost(postId);
        if (!post) {
            throw new CodeError('fanout-no-post', `Could not load post ${postId}`);
        }

        // get all subscribed users
        const strPostId = `${postId}`;
        const users = await this.userRepository.getMainSubscriptionsUsers(post.site_id);

        for (const {user_id} of users) {
            const result = await this.redis.exists(`subscriptions:${user_id}:fanned`);
            if (!result) {
                // skip not fanned-out users
                continue;
            }

            console.log(`update subscription for ${user_id}`);
            await this.redis.zAdd(`subscriptions:${user_id}`, [{ score: post.commented_at.getTime(), value: strPostId }]);
        }
    }

    async siteFanOut(forUserId: number, siteId: number, remove = false) {
        // TODO: check for simultaneous fanouts
        console.log('Fanout site', siteId);
        let posts: { post_id: number, commented_at: Date }[];
        let last_post_id = 0;
        do {
            posts = await this.postRepository.getSitePostUpdateDates(forUserId, siteId, last_post_id, 100);

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

        console.log('Fanout complete', siteId);
    }
}
