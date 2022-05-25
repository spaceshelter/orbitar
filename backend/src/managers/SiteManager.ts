import {SiteBaseInfo, SiteInfo, SiteWithUserInfo} from './types/SiteInfo';
import UserManager from './UserManager';
import SiteRepository from '../db/repositories/SiteRepository';

export default class SiteManager {
    private siteRepository: SiteRepository;
    private cache: Record<string, SiteInfo | undefined> = {};
    private cacheId: Record<number, SiteInfo | undefined> = {};
    private userManager: UserManager;

    constructor(siteRepository: SiteRepository, userManager: UserManager) {
        this.siteRepository = siteRepository;
        this.userManager = userManager;
    }

    async getSiteByName(siteName: string): Promise<SiteInfo | undefined> {
        let site = this.cache[siteName];
        if (site !== undefined) {
            return site;
        }

        const siteRaw = await this.siteRepository.getSiteByName(siteName);
        if (siteRaw) {
            const owner = await this.userManager.getById(siteRaw.owner_id);

            site = {
                id: siteRaw.site_id,
                site: siteRaw.subdomain,
                name: siteRaw.name,
                owner: owner
            };

            this.cacheId[siteRaw.site_id] = site;
        }
        this.cache[siteName] = site;

        return site;
    }

    async getSiteByNameWithUserInfo(forUserId: number, siteName: string): Promise<SiteWithUserInfo | undefined> {
        const siteRaw = await this.siteRepository.getSiteByNameWithUserInfo(forUserId, siteName);
        if (!siteRaw) {
            return;
        }

        const owner = await this.userManager.getById(siteRaw.owner_id);

        const site: SiteWithUserInfo = {
            id: siteRaw.site_id,
            site: siteRaw.subdomain,
            name: siteRaw.name,
            owner: owner,
        };

        if (siteRaw.feed_bookmarks || siteRaw.feed_main) {
            site.subscribe = {
                bookmarks: !!siteRaw.feed_bookmarks,
                main: !!siteRaw.feed_main
            };
        }

        return site;
    }

    async getSiteWithoutOwner(siteName: string): Promise<SiteBaseInfo | undefined> {
        const site = await this.getSiteByName(siteName);
        if (!site) {
            return;
        }

        return {
            id: site.id,
            site: site.site,
            name: site.name
        };
    }

    async getSiteById(siteId: number): Promise<SiteInfo | undefined> {
        let site = this.cacheId[siteId];
        if (site !== undefined) {
            return site;
        }

        const siteRaw = await this.siteRepository.getSiteById(siteId);
        if (siteRaw) {
            const owner = await this.userManager.getById(siteRaw.owner_id);

            site = {
                id: siteRaw.site_id,
                site: siteRaw.subdomain,
                name: siteRaw.name,
                owner: owner
            };
        }
        this.cache[siteRaw.subdomain] = site;
        this.cacheId[siteRaw.site_id] = site;

        return site;
    }

    async siteSubscribe(userId: number, siteId: number, main: boolean, bookmarks: boolean) {
        await this.siteRepository.subscribe(userId, siteId, main, bookmarks);
    }

    async getSubscriptions(forUserId: number): Promise<SiteWithUserInfo[]> {
        const sitesRaw = await this.siteRepository.getSubscriptions(forUserId);
        const sites: SiteWithUserInfo[] = [];

        for (const siteRaw of sitesRaw) {
            const owner = await this.userManager.getById(siteRaw.owner_id);

            const site: SiteWithUserInfo = {
                id: siteRaw.site_id,
                site: siteRaw.subdomain,
                name: siteRaw.name,
                owner: owner,
            };

            if (siteRaw.feed_bookmarks || siteRaw.feed_main) {
                site.subscribe = {
                    bookmarks: !!siteRaw.feed_bookmarks,
                    main: !!siteRaw.feed_main
                };
            }

            sites.push(site);
        }

        return sites;
    }
}
