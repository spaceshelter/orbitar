import APIBase from './APIBase';
import {UserInfo, UserProfileInfo} from '../Types/UserInfo';

type UserResponse = {
    profile: UserProfileInfo;
    invitedBy: UserInfo;
    invites: UserInfo[];
}

export default class UserAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async userProfile(username: string): Promise<UserResponse> {
        return await this.api.request<UserResponse>('/user/profile', {
            username
        });
    }
}
