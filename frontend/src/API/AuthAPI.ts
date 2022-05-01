import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';

type StatusRequest = {};
type StatusResponse = {
    user: UserInfo;
};

type SignInRequest = {};
type SignInResponse = {
    session: string;
    user: UserInfo;
};

type SignOutRequest = {};
type SignOutResponse = {};

export default class AuthAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async status(): Promise<StatusResponse> {
        return await this.api.request<StatusRequest, StatusResponse>('/status', {});
    }

    async signIn(username: string, password: string): Promise<SignInResponse> {
        return await this.api.request<SignInRequest, SignInResponse>('/auth/signin', {
            username,
            password
        });
    }

    async signOut() {
        return await this.api.request<SignOutRequest, SignOutResponse>('/auth/signout', { });
    }
}
