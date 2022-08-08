import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse, validate} from './ApiMiddleware';
import SiteManager from '../managers/SiteManager';
import {SiteSubscribeRequest, SiteSubscribeResponse} from './types/requests/SiteSubscribe';
import {SiteRequest, SiteResponse} from './types/requests/Site';
import FeedManager from '../managers/FeedManager';
import {Enricher} from './utils/Enricher';
import {SiteListRequest, SiteListResponse} from './types/requests/SiteList';
import Joi from 'joi';
import {SiteCreateRequest, SiteCreateResponse} from './types/requests/SiteCreate';
import CodeError from '../CodeError';
import rateLimit from 'express-rate-limit';
import UserManager from '../managers/UserManager';

export default class SiteController {
    public readonly router = Router();
    private readonly logger: Logger;
    private readonly feedManager: FeedManager;
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;
    private readonly enricher: Enricher;

    // 60 per hour
    private readonly subscribeRateLimiter = rateLimit({
        max: 60,
        windowMs: 3600 * 1000,
        skipSuccessfulRequests: false,
        standardHeaders: false,
        legacyHeaders: false,
        keyGenerator: (req) => String(req.session.data?.userId)
    });

    // TODO: have a single source of truth with frontend/src/Conf.ts
    private static readonly siteDomainMinLengthChars = 3;
    private static readonly siteDomainMaxLengthChars = 15;
    private static readonly siteNameMinLengthChars = 3;
    private static readonly siteNameMaxLengthChars = 20;

    constructor(enricher: Enricher, feedManager: FeedManager, siteManager: SiteManager, userManager: UserManager, logger: Logger) {
        this.enricher = enricher;
        this.logger = logger;
        this.feedManager = feedManager;
        this.siteManager = siteManager;
        this.userManager = userManager;

        const siteSchema = Joi.object<SiteRequest>({
            site: Joi.string().required()
        });
        const siteListSchema = Joi.object<SiteListRequest>({
            page: Joi.number().default(1),
            perpage: Joi.number().default(100)
        });
        const siteSubscribeSchema = Joi.object<SiteSubscribeRequest>({
            site: Joi.string().required(),
            main: Joi.boolean().default(false),
            bookmarks: Joi.boolean().default(false)
        });
        const domainValidationRegex = new RegExp('^[a-z\\d-]{' + SiteController.siteDomainMinLengthChars + ',' + SiteController.siteDomainMaxLengthChars + '}$');
        const siteCreateSchema = Joi.object<SiteCreateRequest>({
            site: Joi.string().regex(domainValidationRegex).required(),
            name: Joi.string().min(SiteController.siteNameMinLengthChars).max(SiteController.siteNameMaxLengthChars).required()
        });

        this.router.post('/site', validate(siteSchema), (req, res) => this.site(req, res));
        this.router.post('/site/subscribe', this.subscribeRateLimiter, validate(siteSubscribeSchema), (req, res) => this.subscribe(req, res));
        this.router.post('/site/list', validate(siteListSchema), (req, res) => this.list(req, res));
        this.router.post('/site/create', validate(siteCreateSchema), (req, res) => this.create(req, res));
    }

    async site(request: APIRequest<SiteRequest>, response: APIResponse<SiteResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site } = request.body;

        try {
            const siteInfo = await this.siteManager.getSiteByNameWithUserInfo(userId, site);

            if (!siteInfo) {
                return response.error('no-site', 'Site not found');
            }

            response.success({ site: siteInfo });
        }
        catch (error) {
            this.logger.error('Could not get site', { site });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async subscribe(request: APIRequest<SiteSubscribeRequest>, response: APIResponse<SiteSubscribeResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site, main, bookmarks } = request.body;

        try {
            const result = await this.feedManager.siteSubscribe(userId, site, !!main, !!bookmarks);
            const subscriptions = await this.siteManager.getSubscriptions(userId);

            response.success({
                main: result.main,
                bookmarks: result.bookmarks,
                subscriptions: subscriptions.map(site => this.enricher.siteInfoToEntity(site)),
            });
        }
        catch (error) {
            this.logger.error('Could not change subscription', { site, main, bookmarks, error });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async list(request: APIRequest<SiteListRequest>, response: APIResponse<SiteListResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const {page, perpage} = request.body;

        try {
            const sites = await this.siteManager.getSubsites(userId, page, perpage);

            response.success({
                sites: sites.map(site => this.enricher.siteInfoToEntity(site)),
            });
        }
        catch (error) {
            this.logger.error('Could not get sites', { error });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async create(request: APIRequest<SiteCreateRequest>, response: APIResponse<SiteCreateResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site, name } = request.body;

        try {
            const restrictions = await this.userManager.getUserRestrictions(userId);
            if (!restrictions.canCreateSubsites) {
                return response.error('restriction', 'You cannot create subsites', 403);
            }

            const siteInfo = await this.siteManager.createSite(userId, site, name);

            response.success({ site: siteInfo });
        }
        catch (error) {
            this.logger.error('Could not get site', { site });

            if (error instanceof CodeError) {
                if (error.code === 'site-limit') {
                    return response.error('site-limit', 'Exceed site limit');
                }
                else if (error.code === 'site-exists') {
                    return response.error('site-exists', 'Site already exists');
                }
            }

            return response.error('error', 'Unknown error', 500);
        }
    }
}
