export type SiteSubscribeRequest = {
    site: string;
    main?: boolean;
    bookmarks?: boolean;
};

export type SiteSubscribeResponse = {
    main: boolean;
    bookmarks: boolean;
};
