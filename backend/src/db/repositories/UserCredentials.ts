import DB from '../DB';

export default class UserCredentials {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async setCredential<T>(forUserId: number, type: string, value: T) {
        const stringValue = JSON.stringify(value);
        await this.db.query('insert into user_credentials (`user_id`, `type`, `value`) values(:user_id, :type, :value) on duplicate key update value=:value', {
            user_id: forUserId,
            type,
            value: stringValue
        });
    }

    async resetCredential(forUserId: number, type: string) {
        await this.db.query('delete from user_credentials where user_id=:user_id and `type`=:type', {
            user_id: forUserId,
            type
        });
    }

    async getCredential<T>(forUserId: number, type: string): Promise<T | undefined> {
        const result = await this.db.fetchOne<{value: string}>('select value from user_credentials where user_id=:user_id and `type` = :type', {
            user_id: forUserId,
            type
        });

        if (!result || !result.value) {
            return;
        }

        try {
            return JSON.parse(result.value) as T;
        }
        catch {
            return;
        }
    }
}
