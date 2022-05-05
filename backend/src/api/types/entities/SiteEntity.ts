import {UserBaseEntity} from './UserEntity';

export type SiteBaseEntity = {
    id: number;
    site: string;
    name: string;
};

export type SiteEntity = SiteBaseEntity & {
    owner: UserBaseEntity;
};

export type SiteWithUserInfoEntity = SiteEntity & {
    subscribe?: {
        main: boolean;
        bookmarks: boolean;
    };
};
