import {EditFlag} from './common';

export type PostBaseInfo = {
    id: number;
    site: string;
    title?: string;
    content?: string;
};

export type PostInfo = PostBaseInfo & {
    author: number;
    created: Date;
    editFlag?: EditFlag;
    rating: number;
    comments: number;
    newComments: number;
    canEdit?: boolean;
    bookmark?: boolean;
    watch?: boolean;
    vote?: number;
    lastReadCommentId?: number;
    language?: string;
};
