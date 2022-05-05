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

    isNew?: boolean;
    vote?: number;
    answers?: CommentEntity[];
};

