import DB from '../DB';
import {UserRaw, UserSiteRaw} from '../types/UserRaw';
import {InviteRaw} from '../types/InviteRaw';
import CodeError from '../../CodeError';
import {OkPacket} from 'mysql2';
import {UserGender} from '../../managers/types/UserInfo';
import crypto from 'crypto';
import {FeedSorting} from '../../api/types/entities/common';

export default class UserRepository {
    private db: DB;
    private passwordResetCodeLifeTime = '3 hour';

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
        return await this.db.fetchOne<UserRaw>(
            `select *
             from users
             where username = :username`, {username: username});
    }

    async getPasswordHashByUserId(userId: number): Promise<string | undefined> {
        const result = await this.db.fetchOne<{ password: string }>(
            'select password from users where user_id=:user_id', {user_id: userId});
        return result?.password;
    }

    // TODO: need to decide if we want to encrypt email addresses
    async getUserByEmail(email: string): Promise<UserRaw | undefined> {
        return await this.db.fetchOne<UserRaw>('select * from users where email=:email', {email});
    }

    async generateAndSavePasswordResetForUser(userId: number): Promise<string | undefined> {
        const code = crypto.createHash('sha256').update(Math.random().toString() + userId).digest('hex');
        await this.db.insert('user_password_reset', {
            user_id: userId.toString(),
            code
        });
        return code;
    }

    async getResetPasswordUserIdByResetCode(code: string) {
        return await this.db.fetchOne<{user_id: number}>('select user_id from user_password_reset where code=:code and generated_at > now() - interval ' + this.passwordResetCodeLifeTime, {
            code
        });
    }

    async updatePassword(passwordHash: string, userId: number) {
        const result = await this.db.query('update users set password=:password_hash where user_id=:user_id', {
            password_hash: passwordHash,
            user_id: userId
        }) as OkPacket;
        if (result.affectedRows !== 1) {
            throw 'Failed to update user password';
        }
        return true;
    }

    async clearResetPasswordCode(code: string, userId: number) {
        const result = await this.db.query('delete from user_password_reset where code=:code or user_id=:user_id', {
            code,
            user_id: userId
        }) as OkPacket;
        if (result.affectedRows < 1) {
            throw 'Failed to cleanup reset password code';
        }
        return true;
    }

    async clearResetPasswordExpiredLinks() {
        await this.db.query(`delete from user_password_reset where generated_at < now() - interval ` + this.passwordResetCodeLifeTime);
        return true;
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
            const userInsertResult: OkPacket = await conn.query(
                `insert into users (username, password, gender, name, email, ontrial) values(:username, :password, :gender, :name, :email, :ontrial)`, {
                username: username,
                password: passwordHash,
                gender: gender,
                name: name,
                email: email,
                ontrial: 1
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

    async getUserUnreadComments(forUserId: number, ownOnly = false): Promise<number> {
        const res = await this.db.fetchOne<{ cnt: string }>(`
          select sum(p.comments - ub.read_comments) cnt
            from
              user_bookmarks ub
              join posts p on (p.post_id = ub.post_id)
            where
              ub.user_id = :user_id
              and watch = 1
              ${ownOnly ? 'and p.author_id = :user_id' : ''}
        `, {
            user_id: forUserId
        });

        return parseInt(res.cnt);
    }

    endTrial(userId: number): Promise<void> {
        return this.db.inTransaction(async (conn) => {
            await conn.query('update users set ontrial = 0 where user_id = :user_id', {user_id: userId});

            // copy karma votes into user_trial_approvers
            await conn.query(
                `insert into user_trial_approvers (user_id, voter_id, vote)
                 select user_id, voter_id, vote
                 from user_karma
                 where user_id = :user_id and vote != 0`, {
                    user_id: userId
                });
        });
    }

    logVisit(userId: number, date: Date): Promise<void> {
        // insert format: 2022-05-26 12:00:00.000
        const dateToInsert = date.toISOString().replace('T', ' ').substring(0, 19) +
            '.' + date.getMilliseconds();

        return this.db.query(`
            insert ignore into activity_db.user_activity (user_id, visited_at) values (:user_id, :visited_at)
        `, {user_id: userId, visited_at: dateToInsert});
    }

    async getUserLastVisited(userId: number): Promise<Date | null> {
        const res = await this.db.fetchOne(`
            select max(visited_at) from activity_db.user_activity where user_id=:user_id`,
            {user_id: userId});

        return res['max(visited_at)'];
    }

    getLastActiveUsers(): Promise<UserRaw[]> {
        return this.db.fetchAll(`
            select * from users
            where user_id in (select distinct user_id
                              from activity_db.user_activity
                              where visited_at > subdate(now(), interval 30 day)
                              ) limit 1000
        `);
    }

    /**
     * Returns the number of active users that are not on trial.
     */
    async getNumActiveUsersThatCanVote(): Promise<number> {
        const res = await this.db.fetchOne<{ cnt: string | null }>(`
            select count(*) cnt from (select user_id, count(*) as cnt
                                      from activity_db.user_activity
                                      where visited_at > date_sub(now(), interval 7 day)
                                      and EXISTS(select * from user_karma where voter_id = activity_db.user_activity.user_id and vote != 0)
                                      group by user_id
                                      having cnt > 3) as active_users
                                      join users on (users.user_id = active_users.user_id)
                                      where users.ontrial = 0
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

    async saveBio(bio: string, bioHtml: string, userId: number): Promise<boolean> {
        return this.db.query(`update users set bio_source = :bio, bio_html = :bio_html where user_id = :user_id`, {
            user_id: userId,
            bio: bio,
            bio_html: bioHtml
        });
    }

    async saveName(name: string, userId: number): Promise<boolean> {
        return this.db.query(`update users set name = :name where user_id = :user_id`, {
            user_id: userId,
            name: name
        });
    }

    async saveGender(gender: UserGender, userId: number): Promise<boolean> {
        return this.db.query(`update users set gender = :gender where user_id = :user_id`, {
            user_id: userId,
            gender
        });
    }

    async getUsernames(offset: number): Promise<{username: string}[]> {
        return await this.db.fetchAll<{username: string}>(
            `select username from users order by username limit 1000 offset :offset`,
            { offset }
        );
    }

    async dropPassword(userId: number) {
        return this.db.query(`update users set password = '' where user_id = :user_id`, {user_id: userId});
    }

    async savePublicKey(publicKey: string, userId: number) {
        return this.db.query(`UPDATE users
                              SET public_key = :publicKey
                              WHERE user_id = :userId`, {
            publicKey,
            userId
        });
    }

    getPublicKey(userId: number) {
        return this.db.fetchOne<{public_key: string}>(`SELECT public_key FROM users WHERE user_id = :userId`, {userId})
            .then(res => res?.public_key);
    }
}
