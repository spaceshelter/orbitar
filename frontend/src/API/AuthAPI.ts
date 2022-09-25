import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';

type StatusRequest = {
    site?: string;
};
type StatusResponse = {
    site?: SiteWithUserInfo;
    user: UserInfo;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
    subscriptions: SiteWithUserInfo[];
};

type SignInRequest = Record<string, unknown>;
type SignInResponse = {
    session: string;
    user: UserInfo;
};

type SignOutRequest = Record<string, unknown>;
type SignOutResponse = Record<string, unknown>;

type ResetPasswordRequest = {email: string;};
type ResetPasswordResponse = {result: boolean;};
type CheckResetPasswordCodeRequest = {code: string;};
type SetNewPasswordRequest = {password: string; code: string;};

export default class AuthAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async status(site: string): Promise<StatusResponse> {
        return await this.api.request<StatusRequest, StatusResponse>('/status', { site });
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

    async resetPassword(email: string): Promise<ResetPasswordResponse> {
        return await this.api.request<ResetPasswordRequest, ResetPasswordResponse>('/auth/reset-password', {
            email
        });
    }

    async setNewPassword(password: string, code: string): Promise<ResetPasswordResponse> {
        return await this.api.request<SetNewPasswordRequest, ResetPasswordResponse>('/auth/new-password', {
            password,
            code
        });
    }

    async checkResetPasswordCode(code: string): Promise<ResetPasswordResponse> {
        return this.api.request<CheckResetPasswordCodeRequest, ResetPasswordResponse>('/auth/check-reset-password-code', {code});
    }
}
