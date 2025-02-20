import { AppState } from '../AppState/AppState'
import { FeedSorting } from '../Types/FeedSortingSettings'
import FeedAPI from './FeedAPI'

export default class FeedAPIHelper {
  private api: FeedAPI
  appState: AppState

  constructor(api: FeedAPI, appState: AppState) {
    this.api = api
    this.appState = appState
  }

  async saveSorting(siteSubdomain: string, feedSorting: FeedSorting) {
    try {
      await this.api.saveSorting(siteSubdomain, feedSorting)
    } catch (error) {
      console.log('ERROR SAVING FEED SORTING', error)
      throw new Error('Could not save feed sorting')
    }
  }
}
