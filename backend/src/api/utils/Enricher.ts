import SiteManager from '../../managers/SiteManager'
import { CommentInfoWithPostData } from '../../managers/types/CommentInfo'
import { InviteInfo, InviteInfoWithInvited } from '../../managers/types/InviteInfo'
import { PostInfo } from '../../managers/types/PostInfo'
import { SiteWithUserInfo } from '../../managers/types/SiteInfo'
import UserManager from '../../managers/UserManager'
import { CommentEntity } from '../types/entities/CommentEntity'
import { InviteEntity } from '../types/entities/InviteEntity'
import { PostEntity } from '../types/entities/PostEntity'
import { SiteBaseEntity, SiteWithUserInfoEntity } from '../types/entities/SiteEntity'
import { UserEntity } from '../types/entities/UserEntity'
import { toCommentEntity, toPostEntity, toUserEntities } from './entities'

export type EnrichedPosts = {
  posts: PostEntity[]
  users: Record<number, UserEntity>
  sites: Record<string, SiteBaseEntity>
}

export type EnrichedComments = {
  rootComments: CommentEntity[]
  allComments: CommentEntity[]
  commentsIndex: Record<number, CommentEntity>
  users: Record<number, UserEntity>
}

export class Enricher {
  private readonly siteManager: SiteManager
  private readonly userManager: UserManager

  constructor(siteManager: SiteManager, userManager: UserManager) {
    this.siteManager = siteManager
    this.userManager = userManager
  }

  async enrichRawPosts(rawPosts: PostInfo[]): Promise<EnrichedPosts> {
    const sites: Record<string, SiteBaseEntity> = {}
    const users = toUserEntities(await this.userManager.getByIds(rawPosts.map((post) => post.author)))
    const posts: PostEntity[] = []
    for (const post of rawPosts) {
      if (!sites[post.site]) {
        const site = await this.siteManager.getSiteByName(post.site)
        sites[post.site] = {
          site: site.site,
          name: site.name,
        }
      }

      posts.push(toPostEntity(post))
    }

    return {
      posts,
      users,
      sites,
    }
  }

  async enrichRawComments(
    rawComments: CommentInfoWithPostData[],
    users: Record<number, UserEntity>,
    format: string,
    isNew: (c: CommentEntity) => boolean,
  ): Promise<EnrichedComments> {
    const commentUsers = await this.userManager.getByIds(
      rawComments.map((rawComment) => rawComment.author).filter((authorId) => !users[authorId]),
    )
    Object.assign(users, toUserEntities(commentUsers))

    const commentsIndex: Record<number, CommentEntity> = {}
    const rootComments: CommentEntity[] = []
    const allComments: CommentEntity[] = []

    for (const rawComment of rawComments) {
      const comment: CommentEntity = toCommentEntity(rawComment, false)
      if (isNew(comment)) {
        comment.isNew = true
      }

      commentsIndex[rawComment.id] = comment

      if (!rawComment.parentComment) {
        rootComments.push(comment)
      } else {
        const parentComment = commentsIndex[rawComment.parentComment]
        if (parentComment) {
          if (!parentComment.answers) {
            parentComment.answers = []
          }

          parentComment.answers.push(comment)
        }
      }
      allComments.push(comment)
    }
    return {
      allComments,
      commentsIndex,
      rootComments,
      users,
    }
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
        gender: siteInfo.owner.gender,
      },
    }
    if (siteInfo.subscribe) {
      result.subscribe = siteInfo.subscribe
    }
    return result
  }

  inviteToEntity(invite: InviteInfo | InviteInfoWithInvited): InviteEntity {
    const res = {
      code: invite.code,
      issued: invite.issuedAt.toISOString(),
      invited: [],
      leftCount: invite.leftCount,
      reason: invite.reason,
      reasonSource: invite.reasonSource,
      restricted: invite.restricted,
    }
    if ((invite as InviteInfoWithInvited).invited) {
      res.invited = (invite as InviteInfoWithInvited).invited
    }
    return res
  }
}
