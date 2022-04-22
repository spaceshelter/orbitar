import APIBase from './APIBase';
import {UserGender, UserInfo} from '../Types/UserInfo';

type CheckResponse = {
    code: string;
    inviter: string;
};

type UseResponse = {
    user: UserInfo;
};

export default class InviteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async check(code: string): Promise<CheckResponse> {
        let response = await this.api.request('/invite/check', {code: code}) as CheckResponse;
        return response;
    }

    async use(code: string, username: string, name: string, email: string, password: string, gender: UserGender): Promise<UseResponse> {
        let response = await this.api.request('/invite/use', {
            code: code,
            username,
            name,
            email,
            password,
            gender
        }) as UseResponse;
        console.log('USE', response);
        return response;
    }
}
