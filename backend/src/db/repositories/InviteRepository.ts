import DB from '../DB';
import {InviteRawWithIssuer} from '../types/InviteRaw';

export default class InviteRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getInviteWithIssuer(code: string): Promise<InviteRawWithIssuer | undefined> {
        return await this.db.fetchOne('select i.*, u.username issuer from invites i join users u on (i.issued_by = u.user_id) where code=:code', {code: code});
    }
}
