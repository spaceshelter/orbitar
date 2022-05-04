import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';

type StatusRequest = {
    site: string;
};
type StatusResponse = {
    site: SiteWithUserInfo;
    user: UserInfo;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
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

    async status(site: string): Promise<StatusResponse> {
        return await this.api.request<StatusRequest, StatusResponse>('/status', { site: site });
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
