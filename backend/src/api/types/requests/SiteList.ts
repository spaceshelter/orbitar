import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SiteListRequest = {
    main: boolean;
    page: number;
    perpage: number;
};

export type SiteListResponse = {
    sites: SiteWithUserInfoEntity[];
};
