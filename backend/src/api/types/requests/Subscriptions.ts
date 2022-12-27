import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type SubscriptionsRequest = {};

export type SubscriptionsResponse = {
    subscriptions: SiteWithUserInfoEntity[];
}
