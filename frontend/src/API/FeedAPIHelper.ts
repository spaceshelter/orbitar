import FeedAPI from './FeedAPI';
import {AppState} from '../AppState/AppState';
import {FeedSorting} from '../Types/FeedSortingSettings';

export default class FeedAPIHelper {
    private api: FeedAPI;
    appState: AppState;

    constructor(api: FeedAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async saveSorting(siteSubdomain: string, feedSorting: FeedSorting) {
        try {
            await this.api.saveSorting(siteSubdomain, feedSorting);
        }
        catch (error) {
            console.log('ERROR SAVING FEED SORTING', error);
            throw new Error('Could not save feed sorting');
        }
    }
}
