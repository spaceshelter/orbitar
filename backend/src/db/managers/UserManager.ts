import DB from '../DB';
import {UserRaw} from '../types/UserRaw';
import {User, UserProfile} from '../../types/User';

export default class UserManager {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getRaw(username: string): Promise<UserRaw | undefined> {
        return await this.db.fetchOne('select * from users where username=:username', {username: username});
    }

    async getRawById(userId: number): Promise<UserRaw | undefined> {
        return await this.db.fetchOne('select * from users where user_id=:user_id', {user_id: userId});
    }

    async get(userId: number): Promise<User | undefined> {
        const rawUser = await this.getRawById(userId);

        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        };
    }

    async getByUsername(username: string): Promise<User | undefined> {
        const rawUser = await this.getRaw(username);
        if (!rawUser) {
            return;
        }

        return this.mapUserRaw(rawUser);
    }

    async getFullProfile(username: string, forUserId: number): Promise<UserProfile | undefined> {
        const rawUser = await this.getRaw(username);
        if (!rawUser) {
            return;
        }

        const voteResult = await this.db.fetchOne<{vote: number}>('select vote from user_karma where user_id=:user_id and voter_id=:voter_id', {
            user_id: rawUser.user_id,
            voter_id: forUserId
        })
        const vote = voteResult?.vote;

        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name,
            registered: rawUser.registered_at,
            vote: vote
        };
    }

    private mapUserRaw(rawUser: UserRaw): User {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        }
    }

    async getInvitedBy(userId: number): Promise<User | undefined> {
        const invitedBy = await this.db.fetchOne<UserRaw>('select u.* from user_invites i join users u on (i.parent_id = u.user_id) where i.child_id=:user_id', {
            user_id: userId
        })

        if (!invitedBy) {
            return;
        }

        return this.mapUserRaw(invitedBy);
    }

    async getInvites(userId: number): Promise<User[]> {
        const invites = await this.db.query<UserRaw[]>('select u.* from user_invites i join users u on (i.child_id = u.user_id) where i.parent_id=:user_id order by i.invited', {
            user_id: userId
        })

        return invites.map(raw => this.mapUserRaw(raw));
    }
}
