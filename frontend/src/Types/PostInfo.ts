import {UserInfo} from './UserInfo';

export type PostLinkInfo = {
    id: number;
    site: string;
};

export interface PostInfo extends PostLinkInfo {
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
    watch?: boolean;
    bookmark?: boolean;
    canEdit?: boolean;
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
    editFlag?: boolean;
    postLink: PostLinkInfo;
    answers?: CommentInfo[];
    post?: number;
    site?: string;
    canEdit?: boolean;
}
