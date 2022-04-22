import DB from '../DB';
import {SiteRaw} from '../types/SiteRaw';
import {Site} from '../../types/Site';
import UserManager from './UserManager';

export default class SiteManager {
    private db: DB;
    private cache: Record<string, Site | undefined> = {};
    private cacheId: Record<number, Site | undefined> = {};
    private userManager: UserManager;

    constructor(db: DB, userManager: UserManager) {
        this.db = db;
        this.userManager = userManager;
    }

    async getSiteRaw(siteId: number): Promise<SiteRaw | undefined> {
        let result = await this.db.execute('select * from sites where site_id=:site_id', {site_id: siteId});

        let row = (<SiteRaw> result)[0];
        if (!row) {
            return;
        }

        return row;
    }

    async getSiteByNameRaw(subdomain: string): Promise<SiteRaw | undefined> {
        let result = await this.db.execute('select * from sites where subdomain=:subdomain', {subdomain: subdomain});

        let row = (<SiteRaw> result)[0];
        if (!row) {
            return;
        }

        return row;
    }

    async getSiteByName(subdomain: string): Promise<Site | undefined> {
        let site = this.cache[subdomain];
        if (site !== undefined) {
            return site;
        }

        let siteRaw = await this.getSiteByNameRaw(subdomain);
        if (siteRaw) {
            let owner = await this.userManager.get(siteRaw.owner_id);

            site = {
                id: siteRaw.site_id,
                site: siteRaw.subdomain,
                name: siteRaw.name,
                owner: owner
            }
        }
        this.cache[subdomain] = site;
        this.cacheId[siteRaw.site_id] = site;

        return site;
    }

    async getSiteById(siteId: number): Promise<Site | undefined> {
        let site = this.cacheId[siteId];
        if (site !== undefined) {
            return site;
        }

        let siteRaw = await this.getSiteRaw(siteId);
        if (siteRaw) {
            let owner = await this.userManager.get(siteRaw.owner_id);

            site = {
                id: siteRaw.site_id,
                site: siteRaw.subdomain,
                name: siteRaw.name,
                owner: owner
            }
        }
        this.cache[siteRaw.subdomain] = site;
        this.cacheId[siteRaw.site_id] = site;

        return site;
    }
}
