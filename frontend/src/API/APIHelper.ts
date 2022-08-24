import AuthAPIHelper from './AuthAPIHelper';
import AuthAPI from './AuthAPI';
import InviteAPI from './InviteAPI';
import APIBase, {APIError} from './APIBase';
import {AppLoadingState, AppState} from '../AppState/AppState';
import PostAPI from './PostAPI';
import PostAPIHelper from './PostAPIHelper';
import VoteAPI from './VoteAPI';
import UserAPIHelper from './UserAPIHelper';
import UserAPI from './UserAPI';
import SiteAPI from './SiteAPI';
import SiteAPIHelper from './SiteAPIHelper';
import NotificationsAPI from './NotificationsAPI';
import NotificationsAPIHelper from './NotificationsAPIHelper';
import FeedAPI from './FeedAPI';
import FeedAPIHelper from './FeedAPIHelper';

export default class APIHelper {
    auth: AuthAPIHelper;
    authAPI: AuthAPI;
    inviteAPI: InviteAPI;
    postAPI: PostAPI;
    post: PostAPIHelper;
    voteAPI: VoteAPI;
    user: UserAPIHelper;
    userAPI: UserAPI;
    siteAPI: SiteAPI;
    site: SiteAPIHelper;
    notificationsAPI: NotificationsAPI;
    notifications: NotificationsAPIHelper;
    feedAPI: FeedAPI;
    feed: FeedAPIHelper;
    private baseAPI: APIBase;
    private initRetryCount = 0;
    private appState: AppState;
    private updateInterval: number = parseInt(process.env.REACT_APP_STATUS_UPDATE_INTERVAL || '60');

    constructor(api: APIBase, appState: AppState) {
        this.baseAPI = api;
        this.appState = appState;
        this.authAPI = new AuthAPI(api);
        this.inviteAPI = new InviteAPI(api);
        this.postAPI = new PostAPI(api);
        this.voteAPI = new VoteAPI(api);
        this.siteAPI = new SiteAPI(api);
        this.notificationsAPI = new NotificationsAPI(api);
        this.feedAPI = new FeedAPI(api);
        this.feed = new FeedAPIHelper(this.feedAPI, appState);
        this.post = new PostAPIHelper(this.postAPI, appState);
        this.userAPI = new UserAPI(api, this.post);
        this.auth = new AuthAPIHelper(this.authAPI, appState);
        this.user = new UserAPIHelper(this.userAPI, appState);
        this.site = new SiteAPIHelper(this.siteAPI, appState);
        this.notifications = new NotificationsAPIHelper(this.notificationsAPI, appState);
    }

    async init() {
        try {
            this.appState.appLoadingState = AppLoadingState.loading;

            const status = await this.authAPI.status(this.appState.site);

            this.appState.setUserInfo(status.user);
            this.appState.setWatchCommentsCount(status.watch.comments);
            this.appState.setNotificationsCount(status.notifications);
            this.appState.setSubscriptions(status.subscriptions);
            if (status.site) {
                this.appState.setSiteInfo(status.site);
            }
            this.appState.setAppLoadingState(AppLoadingState.authorized);

            // start fetch status update
            setTimeout(() => {
                this.fetchStatusUpdate().then().catch();
            }, this.updateInterval * 1000);
        }
        catch (error) {
            if (error instanceof APIError) {
                console.log('ME ERROR', error.code, error.message);
                if (error.code === 'auth-required') {
                    this.appState.setAppLoadingState(AppLoadingState.unauthorized);
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
            const status = await this.authAPI.status(this.appState.site);

            this.appState.setUserInfo(status.user);
            this.appState.setWatchCommentsCount(status.watch.comments);
            this.appState.setNotificationsCount(status.notifications);
            this.appState.setSubscriptions(status.subscriptions);
            if (status.site) {
                this.appState.setSiteInfo(status.site);
            }
            this.appState.setAppLoadingState(AppLoadingState.authorized);
        }
        finally {
            setTimeout(() => {
                this.fetchStatusUpdate().then().catch();
            }, this.updateInterval * 1000);
        }
    }

    fixDate(date: Date) {
        return this.baseAPI.fixDate(date);
    }
}
