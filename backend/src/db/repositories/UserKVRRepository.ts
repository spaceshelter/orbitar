import DB from '../DB';

export default class UserKVRRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async setValue(forUserId: number, key: string, value: string) {
        await this.db.query('insert into user_kv (`user_id`, `key`, `value`, `version`) values(:user_id, :key, :value, 1) on duplicate key update value=:value, version=version+1', {
            user_id: forUserId,
            key,
            value
        });
    }

    async getValue(forUserId: number, key: string): Promise<string | undefined> {
        const result = await this.db.fetchOne<{value: string}>('select value from user_kv where user_id=:user_id and `key` = :key', {
            user_id: forUserId,
            key
        });

        if (result) {
            return result.value;
        }
    }
}
