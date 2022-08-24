import {UserBaseEntity} from './UserEntity';

export type SiteBaseEntity = {
    id: number;
    site: string;
    name: string;
};

export type SiteEntity = SiteBaseEntity & {
    owner: UserBaseEntity;
    subscribers: number;
    siteInfo?: string;
};

export type SiteWithUserInfoEntity = SiteEntity & {
    subscribe?: {
        main: boolean;
        bookmarks: boolean;
    };
};
