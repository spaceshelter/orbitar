import {UserBaseInfo} from './UserInfo';

export type InviteInfo = {
    code: string;
    issuedBy: number;
    issuedAt: Date;
    issuedCount: number;
    leftCount: number;
    reason?: string;
    reasonSource?: string;
    restricted: boolean;
};

export type InviteInfoWithInvited = InviteInfo & {
    invited: UserBaseInfo[];
};
