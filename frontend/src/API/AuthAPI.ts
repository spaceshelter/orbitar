import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';

type StatusRequest = Record<string, never>;
export type StatusResponse = {
    user: UserInfo;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: {
        unread: number;
        visible: number;
    }
};

type SignInRequest = Record<string, unknown>;
type SignInResponse = {
    session: string;
    user: UserInfo;
};

type SignOutRequest = Record<string, unknown>;
type SignOutResponse = Record<string, unknown>;

type ResetPasswordRequest = {email: string;};
type ResetPasswordAndSessionsRequest = Record<string, unknown>;
type ResetPasswordAndSessionsResponse = Record<string, unknown>;
type ResetPasswordResponse = {result: boolean;};
type CheckResetPasswordCodeRequest = {code: string;};
type SetNewPasswordRequest = {password: string; code: string;};

export default class AuthAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async status(): Promise<[StatusResponse, string]> {
        let fingerprintHeader = '';
        const status =
            await this.api.request<StatusRequest, StatusResponse>('/status', {},
                (resp) => {
                    fingerprintHeader = resp.headers.get('X-Fingerprint') || '';
                });
        return [status, fingerprintHeader];
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

    async dropPasswordAndSessions() {
        return await this.api.request<ResetPasswordAndSessionsRequest, ResetPasswordAndSessionsResponse>('/auth/drop-password-and-sessions', {});
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
