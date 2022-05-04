import DB from '../DB';
import {UserRaw, UserSiteRaw} from '../types/UserRaw';
import {InviteRaw} from '../types/InviteRaw';
import CodeError from '../../CodeError';
import {OkPacket} from 'mysql2';
import {UserGender, UserStats} from '../../types/User';

export default class UserRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
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

    async getUserStats(forUserId: number): Promise<UserStats> {
        const res = await this.db.fetchOne<{cnt: string | null}>(`
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

        return {
            watch: {
                comments: parseInt(res.cnt),
                posts: 0
            },
            notifications: 0
        };
    }
}
