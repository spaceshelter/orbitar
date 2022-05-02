export type CommentEntity = {
    id: number;
    created: Date;
    author: number;
    deleted?: boolean;
    content: string;
    rating: number;
    parentComment?: number;

    isNew?: boolean;
    vote?: number;
    answers?: CommentEntity[];
};

