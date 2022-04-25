import {UserInfo} from './UserInfo';

export interface PostInfo {
    id: number;
    site: string;
    author: UserInfo;
    created: Date;
    title?: string;
    content: string;
    rating: number;
    comments: number;
    newComments: number;
    vote?: number;
}

export interface CommentInfo {
    id: number;
    created: Date;
    author: UserInfo;
    deleted?: boolean;
    content: string;
    rating: number;
    vote?: number;
    isNew?: boolean;

    answers?: CommentInfo[];
}
