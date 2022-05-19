import {UserBaseEntity} from './UserEntity';

export type InviteEntity = {
    code: string;
    issued: string;
    invited: UserBaseEntity[];
    leftCount: number;
    reason?: string;
};
