export enum FeedSorting {
    postCommentedAt,
    postCreatedAt
}

export type FeedSortingSettings = {
    feed_sorting: FeedSorting;
};

export type FeedSortingSettingsRaw = {
    user_id: number;
    site_id: number;
} & FeedSortingSettings;

export type FeedSortingSettingsBySite = {
    [key: number]: FeedSortingSettings
};

export function getFeedSortingBySiteId(userSettings: FeedSortingSettingsBySite, siteId: number): FeedSorting {
    if (!userSettings || userSettings[siteId] === undefined) {
        return FeedSorting.postCommentedAt;
    }
    return userSettings[siteId].feed_sorting;
}
