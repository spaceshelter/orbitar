import APIBase from './APIBase';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo} from '../Types/SiteInfo';
import {CommentEntity, ContentFormat, PostEntity} from './PostAPI';
import PostAPIHelper from './PostAPIHelper';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import {VoteListItemEntity} from './VoteAPI';

export type UserProfileEntity = UserInfo & {
    registered: string;
    active: boolean;
};
type UseProfileRequest = {
    username: string;
};
type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy: UserInfo;
    invites: UserInfo[];

    invitedReason?: string;
    trialProgress?: number;
    trialApprovers?: VoteListItemEntity[];
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
    parentComments: Record<number, CommentEntity>;
    users: Record<number, UserInfo>;
    total: number;
};
type UserProfileCommentsResult = {
    comments: CommentInfo[];
    parentComments?: Record<number, CommentInfo>
    total: number;
};

export type UserKarmaResponse = {
    senatePenalty: number;
    activeKarmaVotes: Record<string, number>;
    postRatingBySubsite: Record<string, number>;
    commentRatingBySubsite: Record<string, number>;
};

/* see UserRestrictions */
export type UserRestrictionsResponse = {
    effectiveKarma: number;
    senatePenalty: number;

    postSlowModeWaitSec: number;
    postSlowModeWaitSecRemain: number;

    commentSlowModeWaitSec: number;
    commentSlowModeWaitSecRemain: number;

    restrictedToPostId: number | true | false;
    canVote: boolean;
    canVoteKarma: boolean;
    canInvite: boolean;
    canEditOwnContent: boolean;
    canCreateSubsites: boolean;
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
            parentComments: this.postAPIHelper.fixCommentsRecords(result.parentComments, result.users),
            total: result.total,
        };
    }

    async userKarma(username: string): Promise<UserKarmaResponse> {
        return await this.api.request<{username: string}, UserKarmaResponse>('/user/karma', {username});
    }

    userRestrictions(username: string): Promise<UserRestrictionsResponse> {
        return this.api.request<{username: string}, UserRestrictionsResponse>('/user/restrictions', {username});
    }

}
