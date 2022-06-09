import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SiteListRequest = {
    page: number;
    perpage: number;
};

export type SiteListResponse = {
    sites: SiteWithUserInfoEntity[];
};
