import SiteAPI from './SiteAPI';
import {AppState} from '../AppState/AppState';
import {SiteWithUserInfo} from '../Types/SiteInfo';

export default class SiteAPIHelper {
    private api: SiteAPI;
    private appState: AppState;

    constructor(api: SiteAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async create(site: string, name: string) {
        const result = await this.api.create(site, name);
        if (result) {
            this.appState.cache.setSite(result.site);
        }
        return result;
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean) {
        const result = await this.api.subscribe(site, main, bookmarks);
        if (this.appState.siteInfo && this.appState.siteInfo.site === site) {
            this.appState.setSiteInfo({...this.appState.siteInfo, subscribe: result});
        }
        if (result.subscriptions) {
            this.appState.setSubscriptions(result.subscriptions);
        }
    }

    async list(includeMain: boolean, page: number, perpage: number): Promise<SiteWithUserInfo[]> {
        const result = await this.api.list(includeMain, page, perpage);
        return result.sites;
    }
}
