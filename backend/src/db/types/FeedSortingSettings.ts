import {FeedSorting} from '../../api/types/entities/common';

export type FeedSortingSettingsRaw = {
    subdomain: string;
    feed_sorting: FeedSorting;
};

export type FeedSortingSettingsBySite = {
    [key: string]: FeedSorting;
};
