import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo, SiteWithUserInfo} from '../Types/SiteInfo';
import {FeedSorting} from '../Types/FeedSortingSettings';

export type ContentFormat = 'html' | 'source';

export enum EditFlag {
    original,
    edited
}

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
    editFlag?: EditFlag;
    vote?: number;
    language?: string;
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
    editFlag?: EditFlag;

    post: number;
    site: string;

    language?: string;
    answers?: CommentEntity[];
};

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
    site: SiteWithUserInfo;
    sorting: FeedSorting;
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
    sorting: FeedSorting;
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
    noComments?: boolean;
};
type PostGetResponse = {
    post: PostEntity;
    site: SiteInfo;
    comments: CommentEntity[];
    users: Record<number, UserInfo>;
    anonymousUser?: UserInfo;
};

type CommentGetRequest = {
    id: number;
    format?: ContentFormat;
};
type CommentGetResponse = {
    comment: CommentEntity;
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
};

type CommentEditRequest = {
    id: number;
    content: string;
    format?: ContentFormat;
};
type CommentEditResponse = {
    comment: CommentEntity;
    users: Record<number, UserInfo>;
};

type PostEditRequest = {
    id: number;
    title: string;
    content: string;
    format?: ContentFormat;
};
type PostEditResponse = {
    post: PostEntity;
    users: Record<number, UserInfo>;
};

type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};
type PostReadResponse = {
    notifications?: {
        unread: number,
        visible: number
    };
    watch?: {
        comments: number;
        posts: number;
    }
};

type PostPreviewRequestResponse = {
    content: string;
};

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

type HistoryEntity = {
    content: string;
    date: string;
    editor: number;
    changed?: number;
};

type PostHistoryRequest = {
    id: number;
    type: string;
    format?: ContentFormat;
};
type PostHistoryResponse = {
    history: HistoryEntity[];
};

export type TranslateRequest = {
    id: number;
    type: 'post' | 'comment';
};

export type TranslateResponse = {
    title: string;
    html: string;
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

    feedAll(page: number, perpage: number): Promise<FeedSubscriptionsResponse> {
        return this.api.request<FeedSubscriptionsRequest, FeedSubscriptionsResponse>('/feed/all', {
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

    get(postId: number, format: ContentFormat = 'html', noComments = false): Promise<PostGetResponse> {
        return this.api.request<PostGetRequest, PostGetResponse>('/post/get', {
            id: postId,
            format,
            noComments
        });
    }

    comment(content: string, postId: number, commentId?: number): Promise<CommentCreateResponse> {
        return this.api.request<CommentCreateRequest, CommentCreateResponse>('/post/comment', {
            post_id: postId,
            comment_id: commentId,
            content
        });
    }

    getComment(commentId: number, format: ContentFormat = 'html'): Promise<CommentGetResponse> {
        return this.api.request<CommentGetRequest, CommentGetResponse>('/post/get-comment', {
            id: commentId,
            format
        });
    }

    editComment(content: string, commentId: number): Promise<CommentEditResponse> {
        return this.api.request<CommentEditRequest, CommentEditResponse>('/post/edit-comment', {
            id: commentId,
            content
        });
    }

    editPost(postId: number, title: string, content: string): Promise<PostEditResponse> {
        return this.api.request<PostEditRequest, PostEditResponse>('/post/edit', {
            id: postId,
            title,
            content
        });
    }

    preview(text: string): Promise<PostPreviewRequestResponse> {
        return this.api.request<PostPreviewRequestResponse, PostPreviewRequestResponse>('/post/preview', {
            content: text
        });
    }

    translate(id: number, type: 'post' | 'comment'): Promise<TranslateResponse> {
        return this.api.request<TranslateRequest, TranslateResponse>('/post/translate', {
            id,
            type
        });
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

    history(id: number, type: string) {
        return this.api.request<PostHistoryRequest, PostHistoryResponse>('/post/history', {
            id,
            type,
            format: 'html'
        });
    }
}
