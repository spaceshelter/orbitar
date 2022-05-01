import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';

export type UserProfileEntity = UserInfo & {
    registered: string;
}

type UseProfileRequest = {
    username: string;
}
type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy: UserInfo;
    invites: UserInfo[];
}

export default class UserAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async userProfile(username: string): Promise<UserProfileResponse> {
        return await this.api.request<UseProfileRequest, UserProfileResponse>('/user/profile', {
            username
        });
    }
}
