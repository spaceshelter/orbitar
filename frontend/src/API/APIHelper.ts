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
import NotificationsAPI from './NotificationsAPI';
import NotificationsAPIHelper from './NotificationsAPIHelper';

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
    notificationsAPI: NotificationsAPI;
    notifications: NotificationsAPIHelper;
    private baseAPI: APIBase;
    private setters: AppStateSetters;
    private readonly siteName: string;
    private initRetryCount = 0;

    constructor(api: APIBase, setters: AppStateSetters) {
        this.baseAPI = api;
        this.cache = new APICache();
        this.authAPI = new AuthAPI(api);
        this.inviteAPI = new InviteAPI(api);
        this.postAPI = new PostAPI(api);
        this.voteAPI = new VoteAPI(api);
        this.userAPI = new UserAPI(api)
        this.siteAPI = new SiteAPI(api);
        this.notificationsAPI = new NotificationsAPI(api);
        this.post = new PostAPIHelper(this.postAPI, setters, this.cache);
        this.auth = new AuthAPIHelper(this.authAPI, setters);
        this.user = new UserAPIHelper(this.userAPI, this.cache);
        this.site = new SiteAPIHelper(this.siteAPI, setters);
        this.notifications = new NotificationsAPIHelper(this.notificationsAPI, setters);
        this.setters = setters;

        let siteName = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            siteName = window.location.hostname.split('.')[0];
        }
        if (siteName === 'design-test') {
            siteName = 'main';
        }
        this.siteName = siteName;
    }

    updateSetters(setters: AppStateSetters) {
        this.setters = setters;
        this.auth.setters = setters;
    }

    async init() {
        try {
            this.setters.setAppState(AppState.loading);

            const status = await this.authAPI.status(this.siteName);

            this.setters.setUserInfo(status.user);
            this.setters.setSite(status.site);
            this.setters.setAppState(AppState.authorized);
            this.setters.setUserStats({ watch: status.watch, notifications: status.notifications });

            // start fetch status update
            setTimeout(() => {
                this.fetchStatusUpdate().then().catch();
            }, 60 * 1000);
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
                this.initRetryCount++;
                let retryIn = 60 * 1000;
                if (this.initRetryCount === 1) {
                    // first retry in 3 seconds
                    retryIn = 3 * 1000;
                }
                else if (this.initRetryCount < 5) {
                    retryIn = 3 * Math.pow(1.8, 5);
                }
                else if (this.initRetryCount > 10) {
                    // don't try anymore
                    return;
                }
                setTimeout(() => {
                    this.init().then().catch();
                }, retryIn * 1000);
            }
        }
    }

    async fetchStatusUpdate() {
        try {
            const status = await this.authAPI.status(this.siteName);

            this.setters.setUserInfo(status.user);
            this.setters.setSite(status.site);
            this.setters.setAppState(AppState.authorized);
            this.setters.setUserStats({watch: status.watch, notifications: status.notifications});
        }
        finally {
            setTimeout(() => {
                this.fetchStatusUpdate().then().catch();
            }, 60 * 1000);
        }
    }

    fixDate(date: Date) {
        return this.baseAPI.fixDate(date);
    }
}
