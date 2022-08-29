import {InviteEntity} from '../entities/InviteEntity';

export type InviteListRequest = Record<string, never>;

export type InviteListResponse = {
    active: InviteEntity[];
    inactive: InviteEntity[];
    leftToCreate: number;
};
