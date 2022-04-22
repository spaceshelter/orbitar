import {User} from './User';

export interface Site {
    id: number;
    site: string;
    name: string;
    owner: User;
}
