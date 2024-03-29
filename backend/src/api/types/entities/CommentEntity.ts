import {EditFlag} from './common';

export type CommentBaseEntity = {
    id: number;
    author: number;
    content: string;
};

export type CommentEntity = CommentBaseEntity & {
    created: string;
    deleted?: boolean;
    rating: number;
    parentComment?: number;
    editFlag?: EditFlag;

    post: number;
    site: string;

    canEdit?: boolean;
    isNew?: boolean;
    vote?: number;
    answers?: CommentEntity[];

    language?: string;
};

