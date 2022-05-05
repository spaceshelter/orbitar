export type CommentBaseInfo = {
    id: number;
    author: number;
    content: string;
};

export type CommentInfo = CommentBaseInfo & {
    created: Date;
    deleted?: boolean;
    rating: number;
    parentComment?: number;

    isNew?: boolean;
    vote?: number;
    answers?: CommentInfo[];
};

