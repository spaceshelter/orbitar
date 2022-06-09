import {Router} from 'express';
import UserManager from '../managers/UserManager';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {Logger} from 'winston';
import SiteManager from '../managers/SiteManager';
import {StatusRequest, StatusResponse} from './types/requests/Status';
import {Enricher} from './utils/Enricher';

export default class StatusController {
    public readonly router = Router();
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;
    private readonly logger: Logger;
    private readonly enricher: Enricher;

    constructor(enricher: Enricher, siteManager: SiteManager, userManager: UserManager, logger: Logger) {
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.enricher = enricher;
        this.logger = logger;
        this.router.post('/status', (req, res) => this.status(req, res));
    }

    async status(request: APIRequest<StatusRequest>, response: APIResponse<StatusResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const siteName = request.body.site;

        try {
            const userId = request.session.data.userId;
            const user = await this.userManager.getById(userId);
            const site = siteName ? await this.siteManager.getSiteByNameWithUserInfo(userId, siteName) : undefined;
            const stats = await this.userManager.getUserStats(userId);
            const subscriptions = await this.siteManager.getSubscriptions(userId);

            if (!user) {
                // Something wrong, user should exist!
                return response.error('error', 'Unknown error', 500);
            }

            return response.success({
                user,
                site: site ? this.enricher.siteInfoToEntity(site) : undefined,
                subscriptions: subscriptions.map(site => this.enricher.siteInfoToEntity(site)),
                ...stats
            });
        }
        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }


}
