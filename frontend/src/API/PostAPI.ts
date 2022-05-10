import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo} from '../Types/SiteInfo';

export type ContentFormat = 'html' | 'source';

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

    post_id: number;
    site_id: number;

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

type FeedPostsRequest = {
    site: string;
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedPostsResponse = {
    posts: PostEntity[];
    users: Record<number, UserInfo>;
    total: number;
    site: SiteInfo;
};
type FeedSubscriptionsRequest = {
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedSubscriptionsResponse = {
    posts: PostEntity[];
    users: Record<number, UserInfo>;
    total: number;
    sites: Record<string, SiteInfo>;
};
type FeedWatchRequest = {
    filter?: 'all' | 'new';
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};
type FeedWatchResponse = {
    posts: PostEntity[];
    users: Record<number, UserInfo>;
    total: number;
    sites: Record<string, SiteInfo>;
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
    comment: CommentEntity;
    users: Record<number, UserInfo>;
    sites: Record<number, SiteInfo>;
};

type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};
type PostReadResponse = {
    notifications: number;
    watch: {
        comments: number;
        posts: number;
    }
};

type PostPreviewRequestResponse = {
    content: string;
}

type PostBookmarkRequest = {
    post_id: number;
    bookmark: boolean;
};
type PostBookmarkResponse = {
    bookmark: boolean;
};

type PostWatchRequest = {
    post_id: number;
    watch: boolean;
};
type PostWatchResponse = {
    watch: boolean;
};

export default class PostAPI {
    api: APIBase;
    constructor(api: APIBase) {
        this.api = api;
    }

    create(site: string, title: string | undefined, content: string): Promise<PostCreateResponse> {
        return this.api.request<PostCreateRequest, PostCreateResponse>('/post/create', {
            site,
            title,
            content
        });
    }

    feedPosts(site: string, page: number, perpage: number): Promise<FeedPostsResponse> {
        return this.api.request<FeedPostsRequest, FeedPostsResponse>('/feed/posts', {
            site,
            page,
            perpage,
            format: 'html'
        });
    }

    feedSubscriptions(page: number, perpage: number): Promise<FeedSubscriptionsResponse> {
        return this.api.request<FeedSubscriptionsRequest, FeedSubscriptionsResponse>('/feed/subscriptions', {
            page,
            perpage,
            format: 'html'
        });
    }

    feedWatch(all: boolean, page: number, perpage: number): Promise<FeedWatchResponse> {
        return this.api.request<FeedWatchRequest, FeedWatchResponse>('/feed/watch', {
            filter: all ? 'all' : 'new',
            page,
            perpage,
            format: 'html'
        });
    }

    get(postId: number): Promise<PostGetResponse> {
        return this.api.request<PostGetRequest, PostGetResponse>('/post/get', {
            id: postId
        });
    }

    comment(content: string, postId: number, commentId?: number): Promise<CommentCreateResponse> {
        return this.api.request<CommentCreateRequest, CommentCreateResponse>('/post/comment', {
            post_id: postId,
            comment_id: commentId,
            content
        });
    }

    preview(text: string): Promise<PostPreviewRequestResponse> {
        return this.api.request<PostPreviewRequestResponse, PostPreviewRequestResponse>('/post/preview', {
            content: text
        })
    }

    read(postId: number, comments: number, lastCommentId?: number) {
        return this.api.request<PostReadRequest, PostReadResponse>('/post/read', {
            post_id: postId,
            comments: comments,
            last_comment_id: lastCommentId
        });
    }

    bookmark(postId: number, bookmark: boolean) {
        return this.api.request<PostBookmarkRequest, PostBookmarkResponse>('/post/bookmark', {
            post_id: postId,
            bookmark: bookmark
        });
    }

    watch(postId: number, watch: boolean) {
        return this.api.request<PostWatchRequest, PostWatchResponse>('/post/watch', {
            post_id: postId,
            watch: watch
        });
    }
}
