import {Router} from 'express';
import UserManager from '../db/managers/UserManager';
import {User} from '../types/User';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {Logger} from 'winston';
import {SiteWithUserInfo} from '../types/Site';
import SiteManager from '../db/managers/SiteManager';

type StatusRequest = {
    site: string;
};

type StatusResponse = {
    user: User;
    site: SiteWithUserInfo;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
};

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

            if (!site) {
                return response.error('no-site', 'Site not found', 404);
            }

            if (!user) {
                // Something wrong, user should exist!
                return response.error('error', 'Unknown error', 500);
            }

            return response.success({
                user,
                site,
                ...stats
            });
        }
        catch (err) {
            return response.error('error', 'Unknown error', 500);
        }
    }
}
