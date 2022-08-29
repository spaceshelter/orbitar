import DB from '../DB';
import {InviteRaw, InviteRawWithInvited, InviteRawWithIssuer} from '../types/InviteRaw';
import {ResultSetHeader} from 'mysql2';

export default class InviteRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getInvite(code: string): Promise<InviteRaw | undefined>  {
        return await this.db.fetchOne('select i.* from invites i where code=:code', {
            code
        });
    }

    async getInviteWithIssuer(code: string): Promise<InviteRawWithIssuer | undefined> {
        return await this.db.fetchOne('select i.*, u.username issuer from invites i join users u on (i.issued_by = u.user_id) where code=:code', {
            code
        });
    }

    async getInvitesList(forUserId: number): Promise<InviteRawWithInvited[]> {
        return await this.db.fetchAll<InviteRawWithInvited>(`
            select
                i.*,
                u.user_id invited_user_id,
                u.username invited_user_username,
                u.gender invited_user_gender
            from 
                invites i
                    left join user_invites ui on (ui.invite_id = i.invite_id)
                    left join users u on (ui.child_id = u.user_id) 
            where
                i.issued_by = :forUserId
        `, {
            forUserId
        });
    }

    async updateCode(code: string, newCode: string) {
        const result = await this.db.query<ResultSetHeader>('update invites set code=:newCode where code=:code', {
            code,
            newCode
        });

        return result.changedRows > 0;
    }

    getInviteReason(userId: number): Promise<string | undefined> {
        return this.db.fetchOne<{reason: string}>(
            `select reason
             from user_invites ui
                      left join invites i
                                on (i.invite_id = ui.invite_id)
             where ui.child_id = :user_id limit 1`,
            {
                user_id: userId
            }).then(_ => _?.reason);
    }

}
