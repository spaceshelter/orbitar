import APIBase from './APIBase';
import {UserGender, UserInfo} from '../Types/UserInfo';

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
}
