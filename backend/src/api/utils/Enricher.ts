import {SiteBaseEntity, SiteWithUserInfoEntity} from '../types/entities/SiteEntity';
import {UserEntity} from '../types/entities/UserEntity';
import {PostEntity} from '../types/entities/PostEntity';
import UserManager from '../../managers/UserManager';
import SiteManager from '../../managers/SiteManager';
import {CommentEntity} from '../types/entities/CommentEntity';
import {CommentInfoWithPostData} from '../../managers/types/CommentInfo';
import {PostInfo} from '../../managers/types/PostInfo';
import {SiteWithUserInfo} from '../../managers/types/SiteInfo';
import {CommentRaw} from '../../db/types/PostRaw';

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
    parentComments: Record<number, CommentEntity>
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
                id: post.id,
                site: post.site,
                author: post.author,
                created: post.created.toISOString(),
                title: post.title,
                content: post.content,
                rating: post.rating,
                comments: post.comments,
                newComments: post.newComments,
                vote: post.vote
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
                            isNew: (c: CommentEntity) => boolean,
                            rawParentComments: CommentRaw[] = []): Promise<EnrichedComments> {

        const commentsIndex: Record<number, CommentEntity> = {};
        const rootComments: CommentEntity[] = [];
        const allComments: CommentEntity[] = [];
        const parentComments: Record<number, CommentEntity> = {};
        const sites: Record<string, SiteBaseEntity> = {};

        for (const rawComment of rawComments) {
            const comment: CommentEntity = {
                id: rawComment.id,
                created: rawComment.created.toISOString(),
                author: rawComment.author,
                content: rawComment.content,
                rating: rawComment.rating,
                site: rawComment.site,
                post: rawComment.post,
                vote: rawComment.vote,
                parentComment: rawComment.parentComment,
                isNew: false
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

        for (const rawParentComment of rawParentComments) {
            if (!sites[rawParentComment.site_id]) {
                const site = await this.siteManager.getSiteById(rawParentComment.site_id);
                sites[rawParentComment.site_id] = {
                    site: site.site,
                    name: site.name
                };
            }
            const comment: CommentEntity = {
                id: rawParentComment.comment_id,
                created: rawParentComment.created_at.toISOString(),
                author: rawParentComment.author_id,
                content: format === 'html' ? rawParentComment.html : rawParentComment.source,
                rating: rawParentComment.rating,
                site: sites[rawParentComment.site_id].name,
                post: rawParentComment.post_id,
                isNew: false
            };
            parentComments[comment.id] = comment;
            users[rawParentComment.author_id] = users[rawParentComment.author_id] || await this.userManager.getById(rawParentComment.author_id);
        }

        return {
            allComments,
            commentsIndex,
            rootComments,
            users,
            parentComments
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
}
