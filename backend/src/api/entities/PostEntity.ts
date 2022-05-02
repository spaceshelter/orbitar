export type PostEntity = {
    id: number;
    site: string;
    author: number;
    created: Date;
    title?: string;
    content?: string;
    rating: number;
    comments: number;
    newComments: number;
    bookmark: boolean;
    vote?: number;
};
