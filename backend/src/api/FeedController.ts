import FeedManager from '../db/managers/FeedManager';
import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import Joi from 'joi';
import {ContentFormat} from '../types/common';
import {User} from '../types/User';
import {Site} from '../types/Site';
import {PostEntity} from './entities/PostEntity';
import UserManager from '../db/managers/UserManager';
import SiteManager from '../db/managers/SiteManager';

type FeedSubscriptionsRequest = {
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedSubscriptionsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, User>;
    sites: Record<string, Site>;
};

type FeedPostsRequest = {
    site: string;
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedPostsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, User>;
    site: Site;
};

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

        this.router.post('/feed/subscriptions', validate(feedSubscriptionsSchema), (req, res) => this.feedSubscriptions(req, res));
        this.router.post('/feed/posts', validate(feedPostsSchema), (req, res) => this.feedPosts(req, res));
    }

    async feedSubscriptions(request: APIRequest<FeedSubscriptionsRequest>, response: APIResponse<FeedSubscriptionsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { format, page, perpage: perPage } = request.body;

        try {
            await this.feedManager.getSubscriptionFeed(userId, 1, 100);

            const total = await this.feedManager.getSubscriptionsTotal(userId);
            const rawPosts = await this.feedManager.getSubscriptionFeed(userId, page, perPage);

            const sitesN: Record<number, Site> = {};
            const users: Record<number, User> = {};
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
                    created: post.created_at,
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
            const sites: Record<string, Site> = Object.fromEntries(Object.entries(sitesN).map(([k, site]) => { return [ site.site, site ]; }));

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

            console.log('SITE', site, subdomain);

            const siteId = site.id;
            const total = await this.feedManager.getSiteTotal(siteId);

            const rawPosts = await this.feedManager.getSiteFeed(userId, siteId, page, perPage);

            const users: Record<number, User> = {};
            const posts: PostEntity[] = [];
            for (const post of rawPosts) {
                if (!users[post.author_id]) {
                    users[post.author_id] = await this.userManager.getById(post.author_id);
                }

                posts.push({
                    id: post.post_id,
                    site: site.site,
                    author: post.author_id,
                    created: post.created_at,
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
}
