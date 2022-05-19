import {InviteRawWithIssuer} from '../db/types/InviteRaw';
import InviteRepository from '../db/repositories/InviteRepository';
import {InviteInfoWithInvited} from './types/InviteInfo';
import crypto from 'crypto';
import CodeError from '../CodeError';

export default class InviteManager {
    private inviteRepository: InviteRepository;

    constructor(inviteRepository: InviteRepository) {
        this.inviteRepository = inviteRepository;
    }

    async get(code: string): Promise<InviteRawWithIssuer | undefined> {
        return await this.inviteRepository.getInviteWithIssuer(code);
    }

    async listInvites(forUserId: number): Promise<InviteInfoWithInvited[]> {
        const invites: Record<string, InviteInfoWithInvited> = {};
        const rawInvites = await this.inviteRepository.getInvitesList(forUserId);
        for (const rawInvite of rawInvites) {
            if (!invites[rawInvite.code]) {
                invites[rawInvite.code] = {
                    code: rawInvite.code,
                    issuedBy: rawInvite.issued_by,
                    issuedAt: rawInvite.issued_at,
                    issuedCount: rawInvite.issued_count,
                    leftCount: rawInvite.left_count,
                    reason: rawInvite.reason,
                    invited: []
                };
            }

            if (rawInvite.invited_user_id) {
                invites[rawInvite.code].invited.push({
                    id: rawInvite.invited_user_id,
                    username: rawInvite.invited_user_username,
                    gender: rawInvite.invited_user_gender
                });
            }
        }

        return Object.values(invites);
    }

    async regenerate(forUserId: number, code: string): Promise<string> {
        const rawInvite = await this.inviteRepository.getInvite(code);
        if (!rawInvite || rawInvite.issued_by !== forUserId) {
            throw new CodeError('access-denied', 'Access denied');
        }

        const newCode = crypto.randomBytes(16).toString('hex');
        const updated = await this.inviteRepository.updateCode(code, newCode);

        if (!updated) {
            throw new CodeError('unknown', 'Could not regenerate invite code');
        }

        return newCode;
    }
}
