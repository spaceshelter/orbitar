import {UserInfo} from './UserInfo';

export type SiteWithoutOwner = {
    site: string;
    name: string;
};

export type SiteInfo = SiteWithoutOwner & {
    owner: UserInfo;
    subscribers: number;
    siteInfo?: string;
};

export type SiteWithUserInfo = SiteInfo & {
    subscribe?: {
        main: boolean;
        bookmarks: boolean;
    };
};
