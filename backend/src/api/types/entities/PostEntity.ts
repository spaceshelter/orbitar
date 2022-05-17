import {EditFlag} from './common';

export type PostBaseEntity = {
    id: number;
    site: string;
    title?: string;
};

export type PostEntity = PostBaseEntity & {
    author: number;
    created: string;
    content?: string;
    rating: number;
    comments: number;
    newComments: number;
    bookmark?: boolean;
    watch?: boolean;
    canEdit?: boolean;
    editFlag?: EditFlag;
    vote?: number;
};
