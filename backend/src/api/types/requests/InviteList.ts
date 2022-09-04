import {InviteEntity} from '../entities/InviteEntity';

export type InviteListRequest = Record<string, never>;

export type InvitesAvailability = {
    invitesLeft: number;
    daysLeftToNextAvailableInvite?: number;
    inviteWaitPeriodDays: number,
    invitesPerPeriod: number
};

export type InviteListResponse = {
    active: InviteEntity[];
    inactive: InviteEntity[];
    invitesAvailability: InvitesAvailability;
};
