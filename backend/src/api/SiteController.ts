import {Logger} from 'winston';
import {Router} from 'express';
import {APIRequest, APIResponse} from './ApiMiddleware';
import SiteManager from '../managers/SiteManager';
import {SiteSubscribeRequest, SiteSubscribeResponse} from './types/requests/SiteSubscribe';

export default class SiteController {
    public router = Router();
    private logger: Logger;
    private siteManager: SiteManager;

    constructor(siteManager: SiteManager, logger: Logger) {
        this.logger = logger;
        this.siteManager = siteManager;

        this.router.post('/site/subscribe', (req, res) => this.subscribe(req, res));
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
            const result = await this.siteManager.subscribe(userId, site, !!main, !!bookmarks);

            response.success(result);
        }
        catch (error) {
            this.logger.error('Could not change subscription', { site, main, bookmarks, error });
            return response.error('error', 'Unknown error', 500);
        }
    }


}
