import {UserGender} from '../../types/User';

export interface UserRaw {
    user_id: number;
    username: string;
    password: string;
    twofactor?: string;
    gender: UserGender;
    karma: number;
    name: string;
    registered_at: Date;
}
