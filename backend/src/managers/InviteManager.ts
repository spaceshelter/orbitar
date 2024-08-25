import {InviteRawWithInvited, InviteRawWithIssuer} from '../db/types/InviteRaw';
import InviteRepository from '../db/repositories/InviteRepository';
import {InviteInfo, InviteInfoWithInvited} from './types/InviteInfo';
import crypto from 'crypto';
import CodeError from '../CodeError';
import TheParser from '../parser/TheParser';
import UserManager from './UserManager';
import {InvitesAvailability} from '../api/types/requests/InviteList';
import {UserRestrictions} from './types/UserInfo';

export default class InviteManager {
    private inviteRepository: InviteRepository;
    private parser: TheParser;
    private userManager: UserManager;
    private invitesAvailabilityCacheLifeTimeMs = 60 * 60 * 1000; // one hour
    private invitesAvailabilityCache = new Map<number, {
        ts: Date,
        value: InvitesAvailability
    }>();

    constructor(inviteRepository: InviteRepository, parser: TheParser, userManager: UserManager) {
        this.inviteRepository = inviteRepository;
        this.userManager = userManager;
        this.parser = parser;
    }

    async get(code: string): Promise<InviteRawWithIssuer | undefined> {
        return await this.inviteRepository.getInviteWithIssuer(code);
    }

    async listInvites(forUserId: number): Promise<InviteInfoWithInvited[]> {
        const invites: Record<string, InviteInfoWithInvited> = {};
        const rawInvites = await this.inviteRepository.getInvitesList(forUserId);
        for (const rawInvite of rawInvites) {
            if (!invites[rawInvite.code]) {
                invites[rawInvite.code] = this.mapInvite(rawInvite);
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

    mapInvite(invite: InviteRawWithIssuer | InviteRawWithInvited): InviteInfoWithInvited {
        return {
            code: invite.code,
            issuedBy: invite.issued_by,
            issuedAt: invite.issued_at,
            issuedCount: invite.issued_count,
            leftCount: invite.left_count,
            reason: invite.reason,
            reasonSource: invite.reason_source,
            invited: [],
            restricted: invite.restricted === 1
        };
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

    async createInvite(forUserId: number, reasonRaw: string): Promise<InviteInfo> {
        const reasonParseResult = this.parser.parse(reasonRaw);
        const code = crypto.randomBytes(16).toString('hex');
        await this.inviteRepository.createInvite(forUserId, code, reasonParseResult.text, reasonRaw, true);
        const invite = await this.inviteRepository.getInviteWithIssuer(code);
        delete this.invitesAvailabilityCache[forUserId];
        return this.mapInvite(invite);
    }

    async editInvite(forUserId: number, code: string, reasonRaw: string): Promise<InviteInfo> {
        await this.verifyInviteExistsAndAvailable(forUserId, code);

        const reasonParseResult = this.parser.parse(reasonRaw);
        const updated = await this.inviteRepository.updateReason(code, reasonParseResult.text, reasonRaw);
        if (!updated) {
            throw new CodeError('unknown', 'Could not update invite reason');
        }
        const invite = await this.inviteRepository.getInviteWithIssuer(code);
        delete this.invitesAvailabilityCache[forUserId];
        return this.mapInvite(invite);
    }

    getInviteReason(userId: number): Promise<string | undefined> {
        return this.inviteRepository.getInviteReason(userId);
    }

    async delete(userId: number, code: string) {
        await this.verifyInviteExistsAndAvailable(userId, code);

        delete this.invitesAvailabilityCache[userId];
        return this.inviteRepository.deleteInvite(userId, code);
    }

    async verifyInviteExistsAndAvailable(userId: number, code: string): Promise<void> {
        const invite = await this.get(code);
        if (!invite || invite.issued_by !== userId || invite.left_count <= 0) {
            throw new CodeError('invite-not-available', 'Invite not available');
        }
    }

    async getInvitesAvailability(userId: number, skipCache=false): Promise<InvitesAvailability> {
        if (
            !skipCache &&
            this.invitesAvailabilityCache[userId] &&
            (this.invitesAvailabilityCache[userId].ts + this.invitesAvailabilityCacheLifeTimeMs) > Date.now()
        ) {
            return this.invitesAvailabilityCache[userId].value;
        }
        const thisUserRestrictions = await this.userManager.getUserRestrictions(userId);
        if (!thisUserRestrictions || !thisUserRestrictions.canInvite) {
            return {
                invitesLeft: 0,
                inviteWaitPeriodDays: 0,
                invitesPerPeriod: 0
            };
        }

        const gcd = (a: number, b: number): number => {
            if (!b) {
                return a;
            }
            return gcd(b, a % b);
        };

        // currently unused restricted invites number
        const unused = await this.inviteRepository.getInvitesCount(userId, /*used*/false, /*restricted*/ true);
        const invitedUsers = await this.userManager.getInvites(userId);
        let activeIntegratedUsers = 0;
        let rejectedUsers = 0;

        for (const user of invitedUsers) {
            let cachedRestrictions: UserRestrictions | undefined;
            const getRestrictions = async () => {
                cachedRestrictions = cachedRestrictions || await this.userManager.getUserRestrictions(user.id);
                return cachedRestrictions;
            };
            if (!user.ontrial && await this.userManager.isUserActive(user.id) && (await getRestrictions()).canVoteKarma) {
                activeIntegratedUsers++;
            } else if (!(await getRestrictions()).canVote) {
                rejectedUsers++;
            }
        }

        /* each rejected user increases invite waiting period by 1 week */
        let inviteWaitPeriodDays = 7 * (1 + rejectedUsers);
        let invitesPerPeriod = 1 + activeIntegratedUsers;

        /* simplify fraction */
        const gcdResult = gcd(1 + rejectedUsers, invitesPerPeriod);
        inviteWaitPeriodDays /= gcdResult;
        invitesPerPeriod /= gcdResult;

        const msInTheDay = 24 * 60 * 60 * 1000;
        const currentInvitePeriodStartTs = Date.now() - inviteWaitPeriodDays * msInTheDay;
        const usersInTheInvitedPeriod = invitedUsers.reduce((acc, user) =>
            user.registered.getTime() > currentInvitePeriodStartTs ? acc + 1 : acc, 0);

        const invitesLeft = Math.max(0, invitesPerPeriod - usersInTheInvitedPeriod - unused);
        let daysLeftToNextAvailableInvite: number | undefined;

        if (invitesLeft === 0 && unused === 0 && invitesPerPeriod < invitedUsers.length) {
            //sort by registration date descending
            invitedUsers.sort((a, b) => b.registered.getTime() - a.registered.getTime());
            // number of recent invited users that delay the next available invite
            const nextAvailableInviteTs = invitedUsers[invitesPerPeriod - 1].registered.getTime() +
                inviteWaitPeriodDays * msInTheDay;
            daysLeftToNextAvailableInvite = Math.ceil((nextAvailableInviteTs - Date.now()) / msInTheDay);
        }

        const value = {
            invitesLeft,
            daysLeftToNextAvailableInvite,
            inviteWaitPeriodDays,
            invitesPerPeriod
        };
        this.invitesAvailabilityCache[userId] = {
            value,
            ts: Date.now()
        };
        return value;
    }
}
