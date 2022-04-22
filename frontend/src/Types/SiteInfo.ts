import {UserInfo} from './UserInfo';

export interface SiteInfo {
    id: number;
    site: string;
    name: string;
    owner: UserInfo;
}
