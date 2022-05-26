import DB from '../DB';
import {SiteRaw, SiteWithUserInfoRaw} from '../types/SiteRaw';

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
        return await this.db.query('insert into user_sites (site_id, user_id, feed_main, feed_bookmarks) values (:site_id, :user_id, :main, :bookmarks) on duplicate key update feed_main=:main, feed_bookmarks=:bookmarks', {
            site_id: siteId,
            user_id: userId,
            main: main ? 1 : 0,
            bookmarks: bookmarks ? 1 : 0
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
