import {SiteBase, Site, SiteWithUserInfo} from '../../types/Site';
import UserManager from './UserManager';
import SiteRepository from '../repositories/SiteRepository';
import CodeError from '../../CodeError';
import FeedManager from './FeedManager';

export default class SiteManager {
    private siteRepository: SiteRepository;
    private cache: Record<string, Site | undefined> = {};
    private cacheId: Record<number, Site | undefined> = {};
    private userManager: UserManager;
    private feedManager: FeedManager;

    constructor(siteRepository: SiteRepository, userManager: UserManager, feedManager: FeedManager) {
        this.siteRepository = siteRepository;
        this.feedManager = feedManager;
        this.userManager = userManager;
    }

    async getSiteByName(siteName: string): Promise<Site | undefined> {
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
        }
        this.cache[siteName] = site;
        this.cacheId[siteRaw.site_id] = site;

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

    async getSiteWithoutOwner(siteName: string): Promise<SiteBase | undefined> {
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

    async getSiteById(siteId: number): Promise<Site | undefined> {
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

    async subscribe(userId: number, siteName: string, main: boolean, bookmarks: boolean) {
        const site = await this.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const siteId = site.id;
        await this.siteRepository.subscribe(userId, siteId, main, bookmarks);

        // fanout in background
        this.feedManager.siteFanOut(userId, siteId, !main).then().catch();

        return { main, bookmarks };
    }
}
