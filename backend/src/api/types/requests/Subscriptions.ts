import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SubscriptionsRequest = Record<string, never>;

export type SubscriptionsResponse = {
    subscriptions: SiteWithUserInfoEntity[];
};
