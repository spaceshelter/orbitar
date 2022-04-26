import DB from '../DB';
import {UserRaw} from '../types/UserRaw';
import {User, UserGender} from '../../types/User';

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
        let rawUser = await this.getRawById(userId);

        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        };
    }
}
