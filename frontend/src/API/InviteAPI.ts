import APIBase from './APIBase';
import {UserBaseInfo, UserGender, UserInfo} from '../Types/UserInfo';

interface InviteCheckRequest {
    code: string;
}
interface InviteCheckResponse {
    code: string;
    inviter: string;
}

interface InviteUseRequest {
    code: string;
    username: string;
    name: string;
    email: string;
    gender: UserGender;
    password: string;
}
interface InviteUseResponse {
    user: UserInfo;
    session: string;
}

export type InviteEntity = {
    code: string;
    issued: string;
    invited: UserBaseInfo[];
    leftCount: number;
    reason?: string;
    reasonSource?: string;
    restricted: boolean;
};
export type InviteListRequest = {
    username: string;
};

export type InvitesAvailability = {
    invitesLeft: number;
    daysLeftToNextAvailableInvite?: number;
    inviteWaitPeriodDays: number,
    invitesPerPeriod: number
};

export type InviteListResponse = {
    active?: InviteEntity[];
    inactive: InviteEntity[];
    invitesAvailability?: InvitesAvailability;
};

export type InviteRegenerateRequest = {
    code: string;
};
export type InviteRegenerateResponse = {
    code: string;
};

export type InviteCreateRequest = {
    reason: string;
};

export type InviteEditRequest = {
    code: string;
    reason: string;
};

export type InviteDeleteRequest = {
    code: string;
};

export default class InviteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async check(code: string): Promise<InviteCheckResponse> {
        return await this.api.request<InviteCheckRequest, InviteCheckResponse>('/invite/check', {
            code
        });
    }

    async use(code: string, username: string, name: string, email: string, password: string, gender: UserGender): Promise<InviteUseResponse> {
        return await this.api.request<InviteUseRequest, InviteUseResponse>('/invite/use', {
            code,
            username,
            name,
            email,
            password,
            gender
        });
    }

    async list(username: string): Promise<InviteListResponse> {
        return await this.api.request<InviteListRequest, InviteListResponse>('/invite/list', { username });
    }

    async regenerate(code: string): Promise<InviteRegenerateResponse> {
        return await this.api.request<InviteRegenerateRequest, InviteRegenerateResponse>('/invite/regenerate', {
            code
        });
    }

    async create(reason: string): Promise<InviteEntity> {
        return await this.api.request<InviteCreateRequest, InviteEntity>('/invite/create', {reason});
    }

    async delete(code: string): Promise<boolean> {
        return await this.api.request<InviteDeleteRequest, boolean>('/invite/delete', {
            code
        });
    }

    async edit(code: string, reason: string): Promise<InviteEntity> {
        return await this.api.request<InviteEditRequest, InviteEntity>('/invite/edit', {code, reason});
    }
}
