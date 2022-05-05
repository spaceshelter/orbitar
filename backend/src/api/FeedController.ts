import FeedManager from '../managers/FeedManager';
import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import Joi from 'joi';
import {PostEntity} from './types/entities/PostEntity';
import UserManager from '../managers/UserManager';
import SiteManager from '../managers/SiteManager';
import {FeedSubscriptionsRequest, FeedSubscriptionsResponse} from './types/requests/FeedSubscriptions';
import {FeedPostsRequest, FeedPostsResponse} from './types/requests/FeedPosts';
import {FeedWatchRequest, FeedWatchResponse} from './types/requests/FeedWatch';
import {SiteBaseEntity} from './types/entities/SiteEntity';
import {UserEntity} from './types/entities/UserEntity';

export default class FeedController {
    public router = Router();
    private feedManager: FeedManager;
    private siteManager: SiteManager;
    private userManager: UserManager;
    private logger: Logger;

    constructor(feedManager: FeedManager, siteManager: SiteManager, userManager: UserManager, logger: Logger) {
        this.feedManager = feedManager;
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.logger = logger;

        const feedSubscriptionsSchema = Joi.object<FeedSubscriptionsRequest>({
            page: Joi.number().default(1),
            perpage: Joi.number().min(1).max(50).default(10),
            format: joiFormat
        });
        const feedPostsSchema = Joi.object<FeedPostsRequest>({
            site: Joi.string().required(),
            page: Joi.number().default(1),
            perpage: Joi.number().min(1).max(50).default(10),
            format: joiFormat
        });
        const feedWatchSchema = Joi.object<FeedWatchRequest>({
            filter: Joi.valid('all', 'new').default('new').required(),
            page: Joi.number().default(1),
            perpage: Joi.number().min(1).max(50).default(10),
            format: joiFormat
        });

        this.router.post('/feed/subscriptions', validate(feedSubscriptionsSchema), (req, res) => this.feedSubscriptions(req, res));
        this.router.post('/feed/posts', validate(feedPostsSchema), (req, res) => this.feedPosts(req, res));
        this.router.post('/feed/watch', validate(feedWatchSchema), (req, res) => this.feedWatch(req, res));
    }

    async feedSubscriptions(request: APIRequest<FeedSubscriptionsRequest>, response: APIResponse<FeedSubscriptionsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { format, page, perpage: perPage } = request.body;

        try {
            const total = await this.feedManager.getSubscriptionsTotal(userId);
            const rawPosts = await this.feedManager.getSubscriptionFeed(userId, page, perPage);

            const sitesN: Record<number, SiteBaseEntity> = {};
            const users: Record<number, UserEntity> = {};
            const posts: PostEntity[] = [];
            for (const post of rawPosts) {
                if (!users[post.author_id]) {
                    users[post.author_id] = await this.userManager.getById(post.author_id);
                }

                let siteName = '';
                if (!sitesN[post.site_id]) {
                    const site = await this.siteManager.getSiteById(post.site_id);
                    siteName = site?.site || '';
                }
                else {
                    siteName = sitesN[post.site_id].site;
                }


                posts.push({
                    id: post.post_id,
                    site: siteName,
                    author: post.author_id,
                    created: post.created_at.toISOString(),
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                    bookmark: post.bookmark > 1,
                    vote: post.vote
                });
            }

            // reformat sites
            const sites: Record<string, SiteBaseEntity> = Object.fromEntries(Object.entries(sitesN).map(([_, site]) => { return [ site.site, site ]; }));

            response.success({
                posts: posts,
                total: total,
                users: users,
                sites: sites
            });
        }
        catch (err) {
            this.logger.error('Subscriptions feed failed', { error: err, user_id: userId, format });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async feedPosts(request: APIRequest<FeedPostsRequest>, response: APIResponse<FeedPostsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site: subdomain, format, page, perpage: perPage } = request.body;

        try {
            const site = await this.siteManager.getSiteByName(subdomain);
            if (!site) {
                return response.error('no-site', 'Site not found');
            }

            const siteId = site.id;
            const total = await this.feedManager.getSiteTotal(siteId);

            const rawPosts = await this.feedManager.getSiteFeed(userId, siteId, page, perPage);

            const users: Record<number, UserEntity> = {};
            const posts: PostEntity[] = [];
            for (const post of rawPosts) {
                if (!users[post.author_id]) {
                    users[post.author_id] = await this.userManager.getById(post.author_id);
                }

                posts.push({
                    id: post.post_id,
                    site: site.site,
                    author: post.author_id,
                    created: post.created_at.toISOString(),
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                    bookmark: post.bookmark > 1,
                    vote: post.vote
                });
            }

            response.success({
                posts: posts,
                total: total,
                users: users,
                site: site
            });
        }
        catch (err) {
            this.logger.error('Feed failed', { error: err, user_id: userId, site: subdomain, format });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async feedWatch(request: APIRequest<FeedWatchRequest>, response: APIResponse<FeedWatchResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { filter, format, page, perpage: perPage } = request.body;

        try {
            const total = await this.feedManager.getWatchTotal(userId, filter === 'all');
            const rawPosts = await this.feedManager.getWatchFeed(userId, page, perPage, filter === 'all');

            const sitesN: Record<number, SiteBaseEntity> = {};
            const users: Record<number, UserEntity> = {};
            const posts: PostEntity[] = [];
            for (const post of rawPosts) {
                if (!users[post.author_id]) {
                    users[post.author_id] = await this.userManager.getById(post.author_id);
                }

                let siteName = '';
                if (!sitesN[post.site_id]) {
                    const site = await this.siteManager.getSiteById(post.site_id);
                    siteName = site?.site || '';
                }
                else {
                    siteName = sitesN[post.site_id].site;
                }


                posts.push({
                    id: post.post_id,
                    site: siteName,
                    author: post.author_id,
                    created: post.created_at.toISOString(),
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                    bookmark: post.bookmark > 1,
                    vote: post.vote
                });
            }

            // reformat sites
            const sites: Record<string, SiteBaseEntity> = Object.fromEntries(Object.entries(sitesN).map(([_, site]) => { return [ site.site, site ]; }));

            response.success({
                posts: posts,
                total: total,
                users: users,
                sites: sites
            });
        }
        catch (err) {
            this.logger.error('Subscriptions feed failed', { error: err, user_id: userId, format });
            return response.error('error', 'Unknown error', 500);
        }
    }
}
