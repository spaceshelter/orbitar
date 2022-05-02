import SiteAPI from './SiteAPI';
import {AppStateSetters} from '../AppState/AppState';

export default class SiteAPIHelper {
    private api: SiteAPI;
    setters: AppStateSetters;

    constructor(api: SiteAPI, setters: AppStateSetters) {
        this.api = api;
        this.setters = setters;
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean) {
        await this.api.subscribe(site, main, bookmarks);
        this.setters.setSite(prev => {
            if (!prev) return;
            return { ...prev, subscribe: { bookmarks: bookmarks, main: main } };
        });
    }
}
