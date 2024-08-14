import {UserInfo} from './UserInfo';

export type SiteBaseInfo = {
    id: number;
    site: string;
    name: string;
};

export type SiteInfo = SiteBaseInfo & {
    owner: UserInfo;
    subscribers: number;
    infoSource?: string;
    infoHtml?: string;
};

export type SiteWithUserInfo = SiteInfo & {
    subscribe?: {
        main: boolean;
        bookmarks: boolean;
    };
};
