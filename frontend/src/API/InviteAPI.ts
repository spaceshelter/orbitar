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
};
export type InviteListRequest = Record<string, never>;

export type InviteListResponse = {
    active: InviteEntity[];
    inactive: InviteEntity[];
};
export type InviteRegenerateRequest = {
    code: string;
};

export type InviteRegenerateResponse = {
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

    async list(): Promise<InviteListResponse> {
        return await this.api.request<InviteListRequest, InviteListResponse>('/invite/list', {});
    }

    async regenerate(code: string): Promise<InviteRegenerateResponse> {
        return await this.api.request<InviteRegenerateRequest, InviteRegenerateResponse>('/invite/regenerate', {
            code
        });
    }
}
