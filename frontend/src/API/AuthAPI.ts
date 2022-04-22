import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';

type AuthResponse = {
    session: string;
    user: UserInfo;
}

export default class AuthAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async me(): Promise<AuthResponse> {
        let response = await this.api.request('/me', {}) as AuthResponse;

        return response;
    }

    async signIn(username: string, password: string): Promise<AuthResponse> {
        let response = await this.api.request('/auth/signin', { username: username, password: password });

        console.log('RESPONSE SIGNIN', response);
        return response as AuthResponse;
    }

    async signOut() {
        let response = await this.api.request('/auth/signout', {  });

        console.log('RESPONSE SIGNOUT', response);
        return response;
    }
}
