import {SiteBaseEntity, SiteWithUserInfoEntity} from '../types/entities/SiteEntity';
import {UserEntity} from '../types/entities/UserEntity';
import {PostEntity} from '../types/entities/PostEntity';
import UserManager from '../../managers/UserManager';
import SiteManager from '../../managers/SiteManager';
import {CommentEntity} from '../types/entities/CommentEntity';
import {CommentInfoWithPostData} from '../../managers/types/CommentInfo';
import {PostInfo} from '../../managers/types/PostInfo';
import {SiteWithUserInfo} from '../../managers/types/SiteInfo';
import {InviteInfo, InviteInfoWithInvited} from '../../managers/types/InviteInfo';
import {InviteEntity} from '../types/entities/InviteEntity';

export type EnrichedPosts = {
    posts: PostEntity[];
    users: Record<number, UserEntity>;
    sites: Record<string, SiteBaseEntity>;
};

export type EnrichedComments = {
    rootComments: CommentEntity[];
    allComments: CommentEntity[];
    commentsIndex: Record<number, CommentEntity>;
    users: Record<number, UserEntity>;
};

export class Enricher {
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;

    constructor(siteManager: SiteManager, userManager: UserManager) {
        this.siteManager = siteManager;
        this.userManager = userManager;
    }

    async enrichRawPosts(rawPosts: PostInfo[]): Promise<EnrichedPosts> {
        const sites: Record<string, SiteBaseEntity> = {};
        const users: Record<number, UserEntity> = {};
        const posts: PostEntity[] = [];
        for (const post of rawPosts) {
            if (!users[post.author]) {
                users[post.author] = await this.userManager.getById(post.author);
            }

            if (!sites[post.site]) {
                const site = await this.siteManager.getSiteByName(post.site);
                sites[post.site] = {
                    site: site.site,
                    name: site.name
                };
            }

            const postResult: PostEntity = {
                ...post,
                created: post.created.toISOString()
            };

            if (post.bookmark) {
                postResult.bookmark = post.bookmark;
            }
            if (post.watch) {
                postResult.watch = post.watch;
            }
            if (post.canEdit) {
                postResult.canEdit = post.canEdit;
            }
            if (post.editFlag) {
                postResult.editFlag = post.editFlag;
            }

            posts.push(postResult);
        }

        return {
            posts,
            users,
            sites
        };
    }

    async enrichRawComments(rawComments: CommentInfoWithPostData[],
                            users: Record<number, UserEntity>,
                            format: string,
                            isNew: (c: CommentEntity) => boolean): Promise<EnrichedComments> {

        const commentsIndex: Record<number, CommentEntity> = {};
        const rootComments: CommentEntity[] = [];
        const allComments: CommentEntity[] = [];

        for (const rawComment of rawComments) {
            const comment: CommentEntity = {
                ...rawComment,
                created: rawComment.created.toISOString(),
                isNew: false,
                answers: undefined
            };
            if (isNew(comment)) {
                comment.isNew = true;
            }
            if (rawComment.deleted) {
                comment.deleted = true;
            }
            if (rawComment.canEdit) {
                comment.canEdit = true;
            }
            if (rawComment.editFlag) {
                comment.editFlag = rawComment.editFlag;
            }

            users[rawComment.author] = users[rawComment.author] || await this.userManager.getById(rawComment.author);
            commentsIndex[rawComment.id] = comment;

            if (!rawComment.parentComment) {
                rootComments.push(comment);
            }
            else {
                const parentComment = commentsIndex[rawComment.parentComment];
                if (parentComment) {
                    if (!parentComment.answers) {
                        parentComment.answers = [];
                    }

                    parentComment.answers.push(comment);
                }
            }
            allComments.push(comment);
        }
        return {
            allComments,
            commentsIndex,
            rootComments,
            users
        };
    }

    siteInfoToEntity(siteInfo: SiteWithUserInfo): SiteWithUserInfoEntity {
        const result: SiteWithUserInfoEntity = {
            site: siteInfo.site,
            name: siteInfo.name,
            subscribers: siteInfo.subscribers,
            siteInfo: siteInfo.siteInfo,
            owner: {
                id: siteInfo.owner.id,
                username: siteInfo.owner.username,
                gender: siteInfo.owner.gender
            }
        };
        if (siteInfo.subscribe) {
            result.subscribe = siteInfo.subscribe;
        }
        return result;
    }

    inviteToEntity(invite: InviteInfo | InviteInfoWithInvited): InviteEntity {
        const res = {
            code: invite.code,
            issued: invite.issuedAt.toISOString(),
            invited: [],
            leftCount: invite.leftCount,
            reason: invite.reason,
            reasonSource: invite.reasonSource,
            restricted: invite.restricted
        };
        if ((invite as InviteInfoWithInvited).invited) {
            res.invited = (invite as InviteInfoWithInvited).invited;
        }
        return res;
    }
}
