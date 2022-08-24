// TODO: this (and some other types in frontend) are copied from backend, need to find a way to avoid code duplication
export enum FeedSorting {
    postCommentedAt,
    postCreatedAt
}

export type FeedSortingSettings = {
    feed_sorting: FeedSorting;
};

export type FeedSortingSettingsBySite = {
    [key: number]: FeedSortingSettings
};
