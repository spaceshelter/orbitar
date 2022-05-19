import SiteAPI from './SiteAPI';
import {AppState} from '../AppState/AppState';

export default class SiteAPIHelper {
    private api: SiteAPI;
    private appState: AppState;

    constructor(api: SiteAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async site(site: string) {
        const result = await this.api.site(site);
        if (result) {
            this.appState.cache.setSite(result.site);
            if (this.appState.site === site) {
                this.appState.setSiteInfo(result.site);
            }
        }
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean) {
        const result = await this.api.subscribe(site, main, bookmarks);
        if (this.appState.siteInfo && this.appState.siteInfo.site === site) {
            this.appState.setSiteInfo({...this.appState.siteInfo, subscribe: result});
        }
    }
}
