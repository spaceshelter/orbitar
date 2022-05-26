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

export default class SiteController {
    public readonly router = Router();
    private readonly logger: Logger;
    private readonly feedManager: FeedManager;
    private readonly siteManager: SiteManager;
    private readonly enricher: Enricher;

    constructor(enricher: Enricher, feedManager: FeedManager, siteManager: SiteManager, logger: Logger) {
        this.enricher = enricher;
        this.logger = logger;
        this.feedManager = feedManager;
        this.siteManager = siteManager;

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

        this.router.post('/site', validate(siteSchema), (req, res) => this.site(req, res));
        this.router.post('/site/subscribe', validate(siteSubscribeSchema), (req, res) => this.subscribe(req, res));
        this.router.post('/site/list', validate(siteListSchema), (req, res) => this.list(req, res));
    }

    async site(request: APIRequest<SiteRequest>, response: APIResponse<SiteResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site } = request.body;
        if (!site) {
            return response.error('invalid-payload', 'site required', 400);
        }

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
        if (!site) {
            return response.error('invalid-payload', 'site required', 400);
        }

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
}
