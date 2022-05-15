import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo} from '../Types/SiteInfo';
import {CommentEntity, ContentFormat, PostEntity} from './PostAPI';
import PostAPIHelper from './PostAPIHelper';
import {CommentInfo, PostInfo} from '../Types/PostInfo';

export type UserProfileEntity = UserInfo & {
    registered: string;
};
type UseProfileRequest = {
    username: string;
};
type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy: UserInfo;
    invites: UserInfo[];
};
type UserProfilePostsRequest = {
    username: string;
    format?: ContentFormat;
    page?: number;
    perpage?: number;
};
type UserProfilePostsResponse = {
    posts: PostEntity[];
    users: Record<number, UserInfo>;
    total: number;
    sites: Record<string, SiteInfo>;
};
type UserProfilePostsResult = {
    posts: PostInfo[];
    total: number;
};

type UserProfileCommentsRequest = {
    username: string;
    format?: ContentFormat;
    page?: number;
    perpage?: number;
};
type UserProfileCommentsResponse = {
    comments: CommentEntity[];
    users: Record<number, UserInfo>;
    total: number;
};
type UserProfileCommentsResult = {
    comments: CommentInfo[];
    total: number;
};

export default class UserAPI {
    api: APIBase;
    postAPIHelper: PostAPIHelper;

    constructor(api: APIBase, postAPIHelper: PostAPIHelper) {
        this.api = api;
        this.postAPIHelper = postAPIHelper;
    }

    userProfile(username: string): Promise<UserProfileResponse> {
        return this.api.request<UseProfileRequest, UserProfileResponse>('/user/profile', {username});
    }

    async userPosts(username: string, page: number, perpage: number): Promise<UserProfilePostsResult> {
        const result = await this.api.request<UserProfilePostsRequest, UserProfilePostsResponse>('/user/posts', {
            username, format: 'html', page, perpage
        });
        return {
            posts: this.postAPIHelper.fixPosts(result.posts, result.users),
            total: result.total,
        };
    }

    async userComments(username: string, page: number, perpage: number): Promise<UserProfileCommentsResult> {
        const result = await this.api.request<UserProfileCommentsRequest, UserProfileCommentsResponse>('/user/comments', {
            username, format: 'html', page, perpage
        });
        return {
            comments: this.postAPIHelper.fixComments(result.comments, result.users),
            total: result.total,
        };
    }

}
