import UserAPI from './UserAPI';
import {UserInfo, UserProfileInfo} from '../Types/UserInfo';
import {AppState} from '../AppState/AppState';

export type UserProfileResult = {
    profile: UserProfileInfo;
    invitedBy: UserInfo;
    invites: UserInfo[];
};

export default class UserAPIHelper {
    private api: UserAPI;
    private appState: AppState;
    private restrictionRefreshInProgress = false; // avoid duplicate requests

    constructor(api: UserAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async userProfile(username: string): Promise<UserProfileResult> {
        const {profile, invitedBy, invites} = await this.api.userProfile(username);

        const profileInfo: UserProfileInfo = { ...profile } as unknown as UserProfileInfo;

        profileInfo.registered = this.api.api.fixDate(new Date(profile.registered));
        this.appState.cache.setUser(profileInfo);
        return {
            profile: profileInfo,
            invitedBy,
            invites
        };
    }

    refreshUserRestrictions() {
        if (this.appState.userInfo && !this.restrictionRefreshInProgress) {
            this.restrictionRefreshInProgress = true;
            this.api.userRestrictions(this.appState.userInfo.username).then(restrictions => {
                this.appState.setUserRestrictions(restrictions);
            }).finally(() => {
                this.restrictionRefreshInProgress = false;
            });
        }
    }
}
