export enum UserGender {
    fluid,
    he,
    she,
}

export interface UserInfo {
    id: number;
    username: string;
    gender: UserGender;
    name: string;
    karma: number;
}
