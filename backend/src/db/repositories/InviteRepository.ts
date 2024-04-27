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
            order by i.invite_id desc
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

    async updateReason(code: string, reason: string, reason_source: string) {
        const result = await this.db.query<ResultSetHeader>(
            'update invites set reason=:reason, reason_source=:reason_source where code=:code', {
            code,
            reason,
            reason_source
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

    async createInvite(forUserId: number, code: string, reason: string, reason_source: string, restricted=true) {
        await this.db.query<ResultSetHeader>(
            'insert into invites (code, issued_by, issued_at, issued_count, left_count, reason, invites.reason_source, restricted) values (:code, :forUserId, now(), 1, 1, :reason, :reason_source,:restricted)', {
            code,
            forUserId,
            reason,
            reason_source,
            restricted
        });
    }

    deleteInvite(userId: number, code: string): Promise<boolean> {
        return this.db.query<ResultSetHeader>(
            'delete from invites where issued_by = :user_id and code = :code and NOT EXISTS (select * from user_invites where invite_id = invites.invite_id)', {
                user_id: userId,
                code
            }).then(_ => _.affectedRows > 0);
    }

    async getInvitesCount(userId: number, used: boolean, restricted?: boolean): Promise<number> {
        return await this.db.fetchOne<{ count: number }>(
            `select count(*) count
             from invites
             where issued_by = :user_id 
               ${restricted !== undefined ? 'and restricted = ' + (restricted ? '1' : '0') : ''}
               and ((left_count = 0) = :used)`, {
                user_id: userId,
                used
            }).then(_ => _.count);
    }

}
