import DB from '../DB';
import {UserRaw, UserSiteRaw} from '../types/UserRaw';
import {InviteRaw} from '../types/InviteRaw';
import CodeError from '../../CodeError';
import {OkPacket} from 'mysql2';
import {UserGender} from '../../managers/types/UserInfo';
import {FeedSorting} from '../../api/types/entities/common';

export default class UserRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getUserCount(): Promise<number> {
        const result = await this.db.fetchOne<{cnt: string}>('select count(*) cnt from users', {});
        return parseInt(result.cnt || '0');
    }

    async getUserById(userId: number): Promise<UserRaw | undefined> {
        return await this.db.fetchOne<UserRaw>('select * from users where user_id=:user_id', {user_id: userId});
    }

    async getUserByUsername(username: string): Promise<UserRaw | undefined> {
        return await this.db.fetchOne<UserRaw>('select * from users where username=:username', {username: username});
    }

    async getUserParent(userId: number): Promise<UserRaw | undefined> {
        return await this.db.fetchOne<UserRaw>('select u.* from user_invites i join users u on (i.parent_id = u.user_id) where i.child_id=:user_id', {
            user_id: userId
        });
    }

    async getUserChildren(userId: number): Promise<UserRaw[]> {
        return await this.db.query<UserRaw[]>('select u.* from user_invites i join users u on (i.child_id = u.user_id) where i.parent_id=:user_id order by i.invited', {
            user_id: userId
        });
    }

    async userRegister(inviteCode: string, username: string, name: string, email: string, passwordHash: string, gender: UserGender): Promise<UserRaw> {
        return await this.db.inTransaction(async (conn) => {
            const inviteRow: InviteRaw = await conn.fetchOne('select i.* from invites i where code=:code and left_count > 0', {code: inviteCode});
            if (!inviteRow) {
                console.error('Invite not found', inviteCode);
                throw new CodeError('invite-not-found', 'Invite not found');
            }

            const userCountResult = await conn.query<{cnt: string}>('select count(*) cnt from users where username=:username', {username: username});
            if (!userCountResult || userCountResult[0].cnt > 0) {
                console.error('Username exists', username);
                throw new CodeError('username-exists', 'Username exists');
            }

            await conn.query('update invites set left_count=left_count-1 where code=:code', {code: inviteCode});
            const userInsertResult: OkPacket = await conn.query('insert into users (username, password, gender, name, email) values(:username, :password, :gender, :name, :email)', {
                username: username,
                password: passwordHash,
                gender: gender,
                name: name,
                email: email
            });

            const userInsertId = userInsertResult.insertId;
            if (!userInsertId) {
                throw new CodeError('unknown', 'Could not insert user');
            }

            await conn.query('insert into user_invites (parent_id, child_id, invited, invite_id) values(:parent_id, :child_id, now(), :invite_id)', {
                parent_id: inviteRow.issued_by,
                invite_id: inviteRow.invite_id,
                child_id: userInsertId
            });

            // subscribe to main
            await conn.query('insert into user_sites (user_id, site_id) values(:user_id, 1)', {
                user_id: userInsertId
            });

            const userRow = await conn.fetchOne<UserRaw>('select * from users where user_id=:user_id', {user_id: userInsertId});
            if (!userRow) {
                throw new CodeError('unknown', 'Could not select user');
            }

            return userRow;
        });
    }

    async getUserMainSubscriptions(userId: number): Promise<UserSiteRaw[]> {
        return await this.db.fetchAll<UserSiteRaw>(`select * from user_sites where user_id=:user_id and feed_main=1`, { user_id: userId });
    }

    async getMainSubscriptionsUsers(siteId: number): Promise<{ user_id: number }[]> {
        return await this.db.fetchAll<{ user_id: number }>('select user_id from user_sites where site_id=:site_id and feed_main=1', { site_id: siteId });
    }

    async getUserUnreadComments(forUserId: number): Promise<number> {
        const res = await this.db.fetchOne<{ cnt: string }>(`
          select sum(p.comments - ub.read_comments) cnt
            from
              user_bookmarks ub
              join posts p on (p.post_id = ub.post_id)
            where
              ub.user_id = :user_id
              and watch = 1
        `, {
            user_id: forUserId
        });

        return parseInt(res.cnt);
    }

    logVisit(userId: number, date: Date): Promise<void> {
        // insert format: 2022-05-26 12:00:00.000
        const dateToInsert = date.toISOString().replace(/T/, ' ').substring(0, 19) +
            '.' + date.getMilliseconds();

        return this.db.query(`
            insert ignore into activity_db.user_activity (user_id, visited_at) values (:user_id, :visited_at)
        `, {user_id: userId, visited_at: dateToInsert});
    }

    async getNumActiveUsers(): Promise<number> {
        const res = await this.db.fetchOne<{ cnt: string | null }>(`
            select count(*) cnt from (select user_id, count(*) as cnt
                                      from activity_db.user_activity
                                      where visited_at > date_sub(now(), interval 7 day)
                                      group by user_id
                                      having cnt > 3) as active_users
        `);
        return parseInt(res.cnt || '0');
    }

    async isUserActive(userId: number): Promise<boolean> {
        const res = await this.db.fetchOne<{ cnt: string | null }>(`
            select count(*) as cnt
            from activity_db.user_activity
            where user_id = :user_id and visited_at > date_sub(now(), interval 7 day)
        `, {user_id: userId});
        return parseInt(res.cnt || '0') >= 3;
    }

    async saveFeedSorting(site: string, feedSorting: FeedSorting, userId: number) {
        await this.db.query(`insert into feed_sorting_settings (user_id, site_id, feed_sorting) select :user_id, s.site_id, :feed_sorting from sites s where s.subdomain = :site on duplicate key update feed_sorting = :feed_sorting`, {
            user_id: userId,
            site: site,
            feed_sorting: feedSorting
        });
    }

    async getFeedSorting(userId: number, siteId: number): Promise<FeedSorting> {
        const res = await this.db.fetchOne<{ feed_sorting: FeedSorting } | undefined>('select fss.feed_sorting from feed_sorting_settings fss where fss.user_id=:user_id and fss.site_id=:site_id', {user_id: userId, site_id: siteId});
        if (!res) {
            return FeedSorting.postCommentedAt;
        }
        return res.feed_sorting as FeedSorting;
    }
}
