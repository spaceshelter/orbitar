import DB from '../DB';
import {SiteRaw, SiteWithUserInfoRaw} from '../types/SiteRaw';
import CodeError from '../../CodeError';

export default class SiteRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getSiteById(siteId: number): Promise<SiteRaw | undefined> {
        return await this.db.fetchOne('select * from sites where site_id=:site_id', {site_id: siteId});
    }

    async getSiteByName(subdomain: string): Promise<SiteRaw | undefined> {
        return await this.db.fetchOne('select * from sites where subdomain=:subdomain', {subdomain: subdomain});
    }

    async getSiteByNameWithUserInfo(forUserId: number, subdomain: string): Promise<SiteWithUserInfoRaw | undefined> {
        return await this.db.fetchOne<SiteWithUserInfoRaw>(`
                select
                    s.*,
                    u.feed_main,
                    u.feed_bookmarks
                from sites s
                    left join user_sites u on (u.site_id = s.site_id and u.user_id = :user_id) 
                where subdomain=:subdomain`,
{
            subdomain: subdomain,
            user_id: forUserId
        });
    }

    async createSite(forUserId: number, site: string, name: string): Promise<SiteWithUserInfoRaw> {
        return await this.db.inTransaction(async (conn) => {
            // check if already exists
            const siteExistsResult = await conn.fetchOne<{site_id: number}>(`select site_id from sites where subdomain=:site`, {site});
            if (siteExistsResult) {
                throw new CodeError('site-exists', 'Site already exists');
            }

            // check if user have less than 3 subsites
            const siteCountResult = await conn.fetchOne<{cnt: string}>(`select count(*) cnt from sites where owner_id=:forUserId`, {forUserId});
            if (!siteCountResult || Number(siteCountResult.cnt) >= 3) {
                throw new CodeError('site-limit', 'Too much sites');
            }

            // create site
            const siteId = await conn.insert('sites', {
                subdomain: site,
                name,
                owner_id: forUserId,
                subscribers: 1 // self
            });

            // subscribe owner
            await conn.insert('user_sites', {
                user_id: forUserId,
                site_id: siteId,
                feed_main: 1
            });

            // fetch site
            return await conn.fetchOne<SiteWithUserInfoRaw>(`
                select
                    s.*,
                    u.feed_main,
                    u.feed_bookmarks
                from sites s
                    left join user_sites u on (u.site_id = s.site_id and u.user_id = :forUserId) 
                where s.site_id=:siteId`,
                {
                    siteId,
                    forUserId
                });
        });
    }

    async getSubscriptions(forUserId: number): Promise<SiteWithUserInfoRaw[]> {
        return await this.db.fetchAll<SiteWithUserInfoRaw>(`
                select
                    s.*,
                    u.feed_main,
                    u.feed_bookmarks
                from user_sites u
                    join sites s on (u.site_id = s.site_id)
                where
                    u.user_id = :user_id
                    and (u.feed_bookmarks or u.feed_main) 
                    and u.site_id <> 1 
            `,
            {
                user_id: forUserId
            });
    }

    async subscribe(userId: number, siteId: number, main: boolean, bookmarks: boolean) {
        return await this.db.inTransaction(async (conn) => {
            const result = await conn.query('insert into user_sites (site_id, user_id, feed_main, feed_bookmarks) values (:site_id, :user_id, :main, :bookmarks) on duplicate key update feed_main=:main, feed_bookmarks=:bookmarks', {
                site_id: siteId,
                user_id: userId,
                main: main ? 1 : 0,
                bookmarks: bookmarks ? 1 : 0
            });

            await conn.query('update sites s set s.subscribers=(select count(*) from user_sites us where us.site_id=:siteId and us.feed_main=1) where s.site_id=:siteId', {siteId});

            return result;
        });
    }

    async getAllSitesWithUserInfo(forUserId: number, page: number, perpage: number): Promise<SiteWithUserInfoRaw[]> {
        const limitFrom = (page - 1) * perpage;

        return await this.db.fetchAll<SiteWithUserInfoRaw>(`
                select
                    s.*,
                    u.feed_main,
                    u.feed_bookmarks
                from sites s 
                    left join user_sites u on (u.site_id = s.site_id and u.user_id = :forUserId)
                where
                    s.site_id <> 1
                order by
                    s.subscribers desc
                limit
                    :limitFrom, :limit 
            `,
            {
                forUserId,
                limitFrom,
                limit: perpage
            });
    }
}
