import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SiteCreateRequest = {
    site: string;
    name: string;
};

export type SiteCreateResponse = {
    site: SiteWithUserInfoEntity;
};
