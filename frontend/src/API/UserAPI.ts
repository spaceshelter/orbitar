import APIBase from './APIBase'
import {UserInfo} from '../Types/UserInfo'
import {SiteInfo} from "../Types/SiteInfo"
import {ContentFormat, PostEntity} from "./PostAPI"
import PostAPIHelper from "./PostAPIHelper"
import {PostInfo} from "../Types/PostInfo"

export type UserProfileEntity = UserInfo & {
    registered: string;
}
type UseProfileRequest = {
    username: string;
}
type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy: UserInfo;
    invites: UserInfo[];
}
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

export default class UserAPI {
    api: APIBase
    postAPIHelper: PostAPIHelper

    constructor(api: APIBase, postAPIHelper: PostAPIHelper) {
        this.api = api
        this.postAPIHelper = postAPIHelper
    }

    userProfile(username: string): Promise<UserProfileResponse> {
        return this.api.request<UseProfileRequest, UserProfileResponse>('/user/profile', {username})
    }

    async userPosts(username: string, page: number, perpage: number): Promise<UserProfilePostsResult> {
        const result = await this.api.request<UserProfilePostsRequest, UserProfilePostsResponse>('/user/posts', {
            username, format: 'html', page, perpage
        })
        return {
            posts: await this.postAPIHelper.fixPosts(result.posts, result.users),
            total: result.total,
        }
    }
}
