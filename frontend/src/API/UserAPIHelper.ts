import UserAPI from './UserAPI';
import APICache from './APICache';
import {UserInfo, UserProfileInfo} from '../Types/UserInfo';

export type UserProfileResult = {
    profile: UserProfileInfo;
    invitedBy: UserInfo;
    invites: UserInfo[];
};

export default class UserAPIHelper {
    private api: UserAPI;
    private cache: APICache;

    constructor(api: UserAPI, cache: APICache) {
        this.api = api;
        this.cache = cache;
    }

    async userProfile(username: string): Promise<UserProfileResult> {
        const {profile, invitedBy, invites} = await this.api.userProfile(username);

        const profileInfo: UserProfileInfo = { ...profile } as unknown as UserProfileInfo;

        profileInfo.registered = this.api.api.fixDate(new Date(profile.registered));
        this.cache.setUser(profileInfo);
        return {
            profile: profileInfo,
            invitedBy,
            invites
        };
    }
}
