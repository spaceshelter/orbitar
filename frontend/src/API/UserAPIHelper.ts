import UserAPI from './UserAPI';
import APICache from './APICache';

export default class UserAPIHelper {
    private api: UserAPI;
    private cache: APICache;

    constructor(api: UserAPI, cache: APICache) {
        this.api = api;
        this.cache = cache;
    }

    async userProfile(username: string) {
        let profile = await this.api.userProfile(username);
        profile.profile.registered = this.api.api.fixDate(new Date(profile.profile.registered));
        this.cache.setUser(profile.profile);
        return profile;
    }
}
