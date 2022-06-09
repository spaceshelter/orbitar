import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SiteRequest = {
    site: string;
};

export type SiteResponse = {
    site: SiteWithUserInfoEntity;
};
