import {UserBaseInfo} from './UserInfo';
import {EditFlag} from '../API/PostAPI';

export type PostLinkInfo = {
    id: number;
    site: string;
};

export interface PostInfo extends PostLinkInfo {
    id: number;
    site: string;
    author: UserBaseInfo;
    created: Date;
    title?: string;
    content: string;
    rating: number;
    comments: number;
    newComments: number;
    editFlag?: number;
    vote?: number;
    watch?: boolean;
    bookmark?: boolean;
    canEdit?: boolean;
    language?: string;
}

export interface CommentInfo {
    id: number;
    created: Date;
    author: UserBaseInfo;
    deleted?: boolean;
    content: string;
    rating: number;
    vote?: number;
    isNew?: boolean;
    editFlag?: EditFlag;
    postLink: PostLinkInfo;
    answers?: CommentInfo[];
    post?: number;
    site?: string;
    canEdit?: boolean;
    parentComment: number;
    language?: string;
}
