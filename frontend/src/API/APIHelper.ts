import AuthAPIHelper from './AuthAPIHelper';
import AuthAPI from './AuthAPI';
import InviteAPI from './InviteAPI';
import APIBase, {APIError} from './APIBase';
import {AppState, AppStateSetters} from '../AppState/AppState';
import PostAPI from './PostAPI';
import PostAPIHelper from './PostAPIHelper';
import APICache from './APICache';
import VoteAPI from './VoteAPI';
import UserAPIHelper from './UserAPIHelper';
import UserAPI from './UserAPI';
import SiteAPI from './SiteAPI';
import SiteAPIHelper from './SiteAPIHelper';

export default class APIHelper {
    auth: AuthAPIHelper;
    authAPI: AuthAPI;
    inviteAPI: InviteAPI;
    postAPI: PostAPI;
    post: PostAPIHelper;
    cache: APICache;
    voteAPI: VoteAPI;
    user: UserAPIHelper;
    userAPI: UserAPI;
    siteAPI: SiteAPI;
    site: SiteAPIHelper;
    private baseAPI: APIBase;
    private setters: AppStateSetters;

    constructor(api: APIBase, setters: AppStateSetters) {
        this.baseAPI = api;
        this.cache = new APICache();
        this.authAPI = new AuthAPI(api);
        this.inviteAPI = new InviteAPI(api);
        this.postAPI = new PostAPI(api);
        this.voteAPI = new VoteAPI(api);
        this.userAPI = new UserAPI(api)
        this.siteAPI = new SiteAPI(api);
        this.post = new PostAPIHelper(this.postAPI, this.cache);
        this.auth = new AuthAPIHelper(this.authAPI, setters);
        this.user = new UserAPIHelper(this.userAPI, this.cache);
        this.site = new SiteAPIHelper(this.siteAPI, setters);
        this.setters = setters;

        console.log('NEW API HELPER', Math.random());
    }

    updateSetters(setters: AppStateSetters) {
        this.setters = setters;
        this.auth.setters = setters;
    }

    async init() {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }
        if (site === 'design-test') {
            site = 'main';
        }

        try {
            this.setters.setAppState(AppState.loading);

            const status = await this.authAPI.status(site);

            this.setters.setUserInfo(status.user);
            this.setters.setSite(status.site);
            this.setters.setAppState(AppState.authorized);
        }
        catch (error) {
            if (error instanceof APIError) {
                console.log('ME ERROR', error.code, error.message);
                if (error.code === 'auth-required') {
                    this.setters.setAppState(AppState.unauthorized);
                }
            }
            else {
                console.error('ERROR', error);
            }
        }
    }

    fixDate(date: Date) {
        return this.baseAPI.fixDate(date);
    }
}
