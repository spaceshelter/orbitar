export interface SiteRaw {
    site_id: number;
    subdomain: string;
    name: string;
    owner_id: number;
    created_at: Date;
    subscribers: number;
    site_info?: string;
}

export type SiteWithUserInfoRaw = SiteRaw & {
    feed_main: number;
    feed_bookmarks: number;
};