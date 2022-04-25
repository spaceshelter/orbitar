import AuthAPIHelper from './AuthAPIHelper';
import AuthAPI from './AuthAPI';
import InviteAPI from './InviteAPI';
import APIBase, {APIError} from './APIBase';
import {AppState, AppStateSetters} from '../AppState/AppState';
import PostAPI from './PostAPI';
import PostAPIHelper from './PostAPIHelper';
import APICache from './APICache';
import VoteAPI from './VoteAPI';

export default class APIHelper {
    auth: AuthAPIHelper;
    authAPI: AuthAPI;
    inviteAPI: InviteAPI;
    postAPI: PostAPI;
    post: PostAPIHelper;
    cache: APICache;
    voteAPI: VoteAPI;
    private baseAPI: APIBase;
    private setters: AppStateSetters;

    constructor(api: APIBase, setters: AppStateSetters) {
        this.baseAPI = api;
        this.cache = new APICache();
        this.authAPI = new AuthAPI(api);
        this.inviteAPI = new InviteAPI(api);
        this.postAPI = new PostAPI(api);
        this.voteAPI = new VoteAPI(api);
        this.post = new PostAPIHelper(this.postAPI, this.cache);
        this.auth = new AuthAPIHelper(this.authAPI, setters);
        this.setters = setters;

        console.log('NEW API HELPER', Math.random());
    }

    updateSetters(setters: AppStateSetters) {
        this.setters = setters;
        this.auth.setters = setters;
    }

    async init() {
        try {
            this.setters.setAppState(AppState.loading);

            let me = await this.authAPI.me();

            this.setters.setUserInfo(me.user);
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
