export type PostBaseInfo = {
    id: number;
    site: string;
    title?: string;
};

export type PostInfo = PostBaseInfo & {
    author: number;
    created: Date;
    content?: string;
    rating: number;
    comments: number;
    newComments: number;
    bookmark: boolean;
    vote?: number;
};
