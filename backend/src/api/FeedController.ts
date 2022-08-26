import FeedManager from '../managers/FeedManager';
import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse, joiFormat, validate, joiSite} from './ApiMiddleware';
import Joi from 'joi';
import UserManager from '../managers/UserManager';
import SiteManager from '../managers/SiteManager';
import {FeedSubscriptionsRequest, FeedSubscriptionsResponse} from './types/requests/FeedSubscriptions';
import {FeedPostsRequest, FeedPostsResponse} from './types/requests/FeedPosts';
import {FeedWatchRequest, FeedWatchResponse} from './types/requests/FeedWatch';
import PostManager from '../managers/PostManager';
import {Enricher} from './utils/Enricher';
import rateLimit from 'express-rate-limit';
import {FeedSortingSaveRequest, FeedSortingSaveResponse} from './types/requests/FeedSortingSave';
import {FeedSorting, MainSubdomain} from './types/entities/common';

export default class FeedController {
    public readonly router = Router();
    private readonly feedManager: FeedManager;
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;
    private readonly postManager: PostManager;
    private readonly logger: Logger;
    private readonly enricher: Enricher;

    constructor(enricher: Enricher, feedManager: FeedManager, siteManager: SiteManager, userManager: UserManager, postManager: PostManager, logger: Logger) {
        this.enricher = enricher;
        this.feedManager = feedManager;
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.postManager = postManager;
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
        const feedSortingSchema = Joi.object<FeedSortingSaveRequest>({
            site: joiSite.required(),
            feedSorting: Joi.number().valid(FeedSorting.postCreatedAt, FeedSorting.postCommentedAt)
        });

        // limit changing sorting type to 10 times per minute to prevent flooding
        const saveFeedSortingLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 10
        });

        this.router.post('/feed/subscriptions', validate(feedSubscriptionsSchema), (req, res) => this.feedSubscriptions(req, res));
        this.router.post('/feed/all', validate(feedSubscriptionsSchema), (req, res) => this.feedAll(req, res));
        this.router.post('/feed/posts', validate(feedPostsSchema), (req, res) => this.feedPosts(req, res));
        this.router.post('/feed/watch', validate(feedWatchSchema), (req, res) => this.feedWatch(req, res));
        this.router.post('/feed/sorting', saveFeedSortingLimiter, validate(feedSortingSchema), (req, res) => this.saveFeedSorting(req, res));
    }

    async saveFeedSorting(request: APIRequest<FeedSortingSaveRequest>, response: APIResponse<FeedSortingSaveResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;

        try {
            await this.userManager.saveFeedSorting(request.body.site, request.body.feedSorting as FeedSorting, userId);
            this.userManager.clearCache(userId);
            return response.success({});
        }
        catch (err) {
            this.logger.error(`Failed to change feed sorting`, {error: err});
            return response.error('unknown', 'Unknown error', 500);
        }
    }

    async feedSubscriptions(request: APIRequest<FeedSubscriptionsRequest>, response: APIResponse<FeedSubscriptionsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        this.userManager.logVisit(userId);
        const { format, page, perpage: perPage } = request.body;

        try {
            const total = await this.feedManager.getSubscriptionsTotal(userId);
            const rawPosts = await this.feedManager.getSubscriptionFeed(userId, page, perPage, format);
            const { posts, users, sites } = await this.enricher.enrichRawPosts(rawPosts);

            response.success({
                posts,
                total,
                users,
                sites
            });
        }
        catch (err) {
            this.logger.error('Subscriptions feed failed', { error: err, user_id: userId, format });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async feedAll(request: APIRequest<FeedSubscriptionsRequest>, response: APIResponse<FeedSubscriptionsResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        this.userManager.logVisit(userId);
        const { format, page, perpage: perPage } = request.body;

        try {
            const total = await this.feedManager.getAllPostsTotal();
            const user = await this.userManager.getById(userId);
            const rawPosts = await this.feedManager.getAllPosts(userId, page, perPage, format, UserManager.getFeedSortingBySite(user.feedSortingSettings, MainSubdomain));
            const { posts, users, sites } = await this.enricher.enrichRawPosts(rawPosts);

            response.success({
                posts,
                total,
                users,
                sites
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
        this.userManager.logVisit(userId);
        const { site: subdomain, format, page, perpage: perPage } = request.body;

        try {
            const site = await this.siteManager.getSiteByNameWithUserInfo(userId, subdomain);

            if (!site) {
                return response.error('no-site', 'Site not found');
            }

            const siteId = site.id;
            const total = await this.feedManager.getSiteTotal(siteId);
            const user = await this.userManager.getById(userId);
            const rawPosts = await this.feedManager.getSiteFeed(userId, siteId, page, perPage, format, UserManager.getFeedSortingBySite(user.feedSortingSettings, subdomain));
            const { posts, users } = await this.enricher.enrichRawPosts(rawPosts);

            response.success({
                posts,
                total,
                users,
                site: this.enricher.siteInfoToEntity(site)
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
        this.userManager.logVisit(userId);
        const { filter, format, page, perpage: perPage } = request.body;

        try {
            const total = await this.feedManager.getWatchTotal(userId, filter === 'all');
            const user = await this.userManager.getById(userId);
            const rawPosts = await this.feedManager.getWatchFeed(userId, page, perPage, filter === 'all', format, UserManager.getFeedSortingBySite(user.feedSortingSettings, MainSubdomain));
            const { posts, users, sites } = await this.enricher.enrichRawPosts(rawPosts);

            response.success({
                posts,
                total,
                users,
                sites
            });
        }
        catch (err) {
            this.logger.error('Subscriptions feed failed', { error: err, user_id: userId, format });
            return response.error('error', 'Unknown error', 500);
        }
    }
}
