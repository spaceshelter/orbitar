import {Router} from 'express';
import UserManager from '../managers/UserManager';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {Logger} from 'winston';
import SiteManager from '../managers/SiteManager';
import {StatusRequest, StatusResponse} from './types/requests/Status';
import {SiteWithUserInfo} from '../managers/types/SiteInfo';
import {SiteWithUserInfoEntity} from './types/entities/SiteEntity';

export default class StatusController {
    public router = Router();
    private siteManager: SiteManager;
    private userManager: UserManager;
    private logger: Logger;

    constructor(siteManager: SiteManager, userManager: UserManager, logger: Logger) {
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.logger = logger;
        this.router.post('/status', (req, res) => this.status(req, res));
    }

    async status(request: APIRequest<StatusRequest>, response: APIResponse<StatusResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const siteName = request.body.site;
        if (!siteName) {
            return response.error('invalid-payload', 'site required', 400);
        }

        try {
            const userId = request.session.data.userId;
            const user = await this.userManager.getById(userId);
            const site = await this.siteManager.getSiteByNameWithUserInfo(userId, siteName);
            const stats = await this.userManager.getUserStats(userId);
            const subscriptions = await this.siteManager.getSubscriptions(userId);

            if (!site) {
                return response.error('no-site', 'Site not found', 404);
            }

            if (!user) {
                // Something wrong, user should exist!
                return response.error('error', 'Unknown error', 500);
            }

            return response.success({
                user,
                site: this.siteInfoToEntity(site),
                subscriptions: subscriptions.map(site => this.siteInfoToEntity(site)),
                ...stats
            });
        }
        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }

    private siteInfoToEntity(siteInfo: SiteWithUserInfo): SiteWithUserInfoEntity {
        const result: SiteWithUserInfoEntity = {
            site: siteInfo.site,
            name: siteInfo.name,
            owner: {
                id: siteInfo.owner.id,
                username: siteInfo.owner.username,
                gender: siteInfo.owner.gender
            }
        };
        if (siteInfo.subscribe) {
            result.subscribe = siteInfo.subscribe;
        }
        return result;
    }
}
