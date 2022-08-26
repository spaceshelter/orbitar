import {FeedSortingSettingsBySite} from '../types/FeedSortingSettings';
import {FeedSorting} from '../../api/types/entities/common';

export function getFeedSortingBySite(feedSortingSettings: FeedSortingSettingsBySite, site: string): FeedSorting {
    if (!feedSortingSettings || feedSortingSettings[site] === undefined) {
        return FeedSorting.postCommentedAt;
    }
    return feedSortingSettings[site];
}
