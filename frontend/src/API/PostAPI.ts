import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo} from '../Types/SiteInfo';

type ContentFormat = 'html' | 'source';

export type PostEntity = {
    id: number;
    site: string;
    author: number;
    created: string;
    title?: string;
    content: string;
    rating: number;
    comments: number;
    newComments: number;
    vote?: number;
};

export type CommentEntity = {
    id: number;
    created: string;
    author: number;
    deleted?: boolean;
    content: string;
    rating: number;
    vote?: number;
    isNew?: boolean;

    answers?: CommentEntity[];
}

type PostCreateRequest = {
    site: string;
    title?: string;
    content: string;
    format?: ContentFormat;
};
type PostCreateResponse = {
    post: PostEntity;
};

type FeedRequest = {
    site: string;
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedResponse = {
    posts: PostEntity[];
    users: Record<number, UserInfo>;
    total: number;
    site: SiteInfo;
};


type PostGetRequest = {
    id: number;
    format?: ContentFormat;
};
type PostGetResponse = {
    post: PostEntity;
    site: SiteInfo;
    comments: CommentEntity[];
    users: Record<number, UserInfo>;
};

type CommentCreateRequest = {
    comment_id?: number;
    post_id: number;
    content: string;
    format?: ContentFormat;
};
type CommentCreateResponse = {
    comment: CommentEntity[];
    users: Record<number, UserInfo>;
};

type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};
type PostReadResponse = {};

export default class PostAPI {
    api: APIBase;
    constructor(api: APIBase) {
        this.api = api;
    }

    async create(site: string, title: string | undefined, content: string): Promise<PostCreateResponse> {
        return await this.api.request<PostCreateRequest, PostCreateResponse>('/post/create', {
            site,
            title,
            content
        });
    }

    async feed(site: string, page: number, perpage: number): Promise<FeedResponse> {
        return await this.api.request<FeedRequest, FeedResponse>('/post/feed', {
            site,
            page,
            perpage,
            format: 'html'
        });
    }

    async get(postId: number): Promise<PostGetResponse> {
        return await this.api.request<PostGetRequest, PostGetResponse>('/post/get', {
            id: postId
        });
    }

    async comment(content: string, postId: number, commentId?: number): Promise<CommentCreateResponse> {
        return await this.api.request<CommentCreateRequest, CommentCreateResponse>('/post/comment', {
            post_id: postId,
            comment_id: commentId,
            content
        });
    }

    async read(postId: number, comments: number, lastCommentId?: number) {
        return await this.api.request<PostReadRequest, PostReadResponse>('/post/read', {
            post_id: postId,
            comments: comments,
            last_comment_id: lastCommentId
        });
    }
}
