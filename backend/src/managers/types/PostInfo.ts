export type PostBaseInfo = {
    id: number;
    site: string;
    title?: string;
    content?: string;
};

export type PostInfo = PostBaseInfo & {
    author: number;
    created: Date;
    rating: number;
    comments: number;
    newComments: number;
    bookmark: boolean;
    watch: boolean;
    vote?: number;
};
