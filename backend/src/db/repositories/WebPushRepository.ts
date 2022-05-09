import DB from '../DB';
import {PushSubscription} from 'web-push';

export default class WebPushRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async setSubscription(forUserId: number, subscription: PushSubscription) {
        const stringValue = JSON.stringify(subscription);
        await this.db.query('insert into user_webpush (`user_id`, `auth`, `subscription`) values(:user_id, :auth, :subscription) on duplicate key update subscription=:subscription', {
            user_id: forUserId,
            auth: subscription.keys.auth,
            subscription: stringValue
        });
    }

    async resetSubscription(forUserId: number, auth: string) {
        await this.db.query('delete from user_webpush where user_id=:user_id and auth=:auth', {
            user_id: forUserId,
            auth
        });
    }

    async getSubscription(forUserId: number, auth: string): Promise<PushSubscription | undefined> {
        const result = await this.db.fetchOne<{subscription: string}>('select subscription from user_webpush where user_id=:user_id and auth = :auth', {
            user_id: forUserId,
            auth
        });

        if (!result || !result.subscription) {
            return;
        }

        try {
            return JSON.parse(result.subscription) as PushSubscription;
        }
        catch {
            return;
        }
    }

    async getSubscriptions(forUserId: number): Promise<PushSubscription[]> {
        const results = await this.db.fetchAll<{subscription: string}>('select subscription from user_webpush where user_id=:user_id', {
            user_id: forUserId
        });

        if (!results) {
            return;
        }

        return results.map(sub => {
            try {
                return JSON.parse(sub.subscription) as PushSubscription;
            }
            catch {
                return;
            }
        });
    }
}
