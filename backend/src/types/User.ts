export enum UserGender {
    fluid,
    he,
    she,
}

export interface User {
    id: number;
    username: string;
    gender: UserGender;
    karma: number;
    name: string;
}
