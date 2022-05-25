import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse} from './ApiMiddleware';
import SiteManager from '../managers/SiteManager';
import {SiteSubscribeRequest, SiteSubscribeResponse} from './types/requests/SiteSubscribe';
import {SiteRequest, SiteResponse} from './types/requests/Site';
import FeedManager from '../managers/FeedManager';

export default class SiteController {
    public router = Router();
    private logger: Logger;
    private feedManager: FeedManager;
    private siteManager: SiteManager;

    constructor(feedManager: FeedManager, siteManager: SiteManager, logger: Logger) {
        this.logger = logger;
        this.feedManager = feedManager;
        this.siteManager = siteManager;

        this.router.post('/site', (req, res) => this.site(req, res));
        this.router.post('/site/subscribe', (req, res) => this.subscribe(req, res));
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

            response.success(result);
        }
        catch (error) {
            this.logger.error('Could not change subscription', { site, main, bookmarks, error });
            return response.error('error', 'Unknown error', 500);
        }
    }


}
