import SiteAPI from './SiteAPI';
import {AppState} from '../AppState/AppState';

export default class SiteAPIHelper {
    private api: SiteAPI;
    private appState: AppState;

    constructor(api: SiteAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean) {
        await this.api.subscribe(site, main, bookmarks);
        if (this.appState.site) {
            this.appState.setSite({...this.appState.site, subscribe: { bookmarks, main }});
        }
    }
}
