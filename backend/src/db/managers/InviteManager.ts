import DB from '../DB';
import {UserGender} from '../../types/User';
import {OkPacket} from 'mysql2';
import CodeError from '../../CodeError';
import {UserRaw} from '../types/UserRaw';
import {InviteRaw} from '../types/InviteRaw';

type InviteRawWithIssuer = InviteRaw & { issuer: string }

export default class InviteManager {
    private db: DB
    constructor(db: DB) {
        this.db = db;
    }

    async get(code: string): Promise<InviteRawWithIssuer | undefined> {
        let result = await this.db.execute('select i.*, u.username issuer from invites i join users u on (i.issued_by = u.user_id) where code=:code', {code: code});

        let row = (<InviteRawWithIssuer> result)[0];
        if (!row) {
            return;
        }

        return row;
    }

    async use(code: string, username: string, name: string, email: string, passwordHash: string, gender: UserGender): Promise<UserRaw> {
        let connection = await this.db.beginTransaction();

        try {
            let inviteResult = await this.db.execute('select i.* from invites i where code=:code and left_count > 0', {code: code}, connection);
            let inviteRow = (<InviteRaw>inviteResult)[0];
            if (!inviteRow) {
                console.error('Invite not found');
                throw new CodeError('invite-not-found', 'Invite not found');
            }

            let userCountResult = await this.db.execute('select count(*) cnt from users where username=:username', {username: username}, connection);
            if (!userCountResult || userCountResult[0].cnt > 0) {
                console.error('Username exists');
                throw new CodeError('username-exists', 'Username exists');
            }

            await this.db.execute('update invites set left_count=left_count-1 where code=:code', {code: code}, connection);
            let userInsertResult = await this.db.execute('insert into users (username, password, gender, name, email) values(:username, :password, :gender, :name, :email)', {
                username: username,
                password: passwordHash,
                gender: gender,
                name: name,
                email: email
            }, connection);

            let userInsertId = (<OkPacket> userInsertResult).insertId;
            if (!userInsertId) {
                throw new CodeError('unknown', 'Could not insert user');
            }

            await this.db.execute('insert into user_invites (parent_id, child_id, invited, invite_id) values(:parent_id, :child_id, now(), :invite_id)', {
                parent_id: inviteRow.issued_by,
                invite_id: inviteRow.invite_id,
                child_id: userInsertId
            }, connection);

            await this.db.commit(connection);

            let userResult = await this.db.execute('select * from users where user_id=:user_id', {user_id: userInsertId});
            let userRow = (<UserRaw> userResult)[0];
            if (!userRow) {
                throw new CodeError('unknown', 'Could not select user')
            }

            return userRow;
        }
        catch (err) {
            console.error(err);
            await this.db.rollback(connection);

            if (err instanceof CodeError) {
                throw err;
            }

            throw new CodeError('unknown', err instanceof Error ? err.message : 'Unknown error');
        }
    }
}
