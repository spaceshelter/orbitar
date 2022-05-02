import {User} from './User';

export type SiteBase = {
    id: number;
    site: string;
    name: string;
};

export type Site = SiteBase & {
    owner: User;
};

export type SiteWithUserInfo = Site & {
    subscribe?: {
        main: boolean;
        bookmarks: boolean;
    };
};
