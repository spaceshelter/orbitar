import React from 'react'
import { Link } from 'react-router-dom'

import { EditFlag } from '@api/PostAPI'
import { VirtualizedItem } from '@utils/Virtualized'
import { observer } from 'mobx-react-lite'

import { PostLinkInfo } from '../Types/PostInfo'
import { UserBaseInfo } from '../Types/UserInfo'
import DateComponent from './DateComponent'
import PostLink from './PostLink'
import Username from './Username'

import styles from './SignatureComponent.module.scss'

interface SignatureComponentProps {
  showSite?: boolean
  site?: string
  author: UserBaseInfo
  editFlag?: EditFlag
  onHistoryClick: () => void
  postLink: PostLinkInfo
  postLinkIsNew?: boolean
  parentCommentId?: number
  parentCommentAuthor?: string
  date: Date
  commentId?: number
  virtualizedItem?: VirtualizedItem
}

export const SignatureComponent = observer((props: SignatureComponentProps) => {
  if (props.virtualizedItem && !props.virtualizedItem.isVisible) {
    return (
      <div className={styles.signature}>
        {props.author.username} {props.parentCommentAuthor}
      </div>
    )
  }

  return (
    <div className={styles.signature}>
      {props.showSite && props.site && props.site !== 'main' ? (
        <>
          <Link to={`/s/${props.site}`}>{props.site}</Link> •{' '}
        </>
      ) : (
        ''
      )}
      <Username className={styles.username} user={props.author} /> •{' '}
      <PostLink post={props.postLink} commentId={props.commentId}>
        <DateComponent date={props.date} />
      </PostLink>
      {!!props.parentCommentId && (
        <>
          {' '}
          •{' '}
          <PostLink
            className={'arrow i i-arrow'}
            post={props.postLink}
            onlyNew={props.postLinkIsNew}
            commentId={props.parentCommentId}
          >
            {' '}
            {props.parentCommentAuthor}
          </PostLink>
        </>
      )}
      {props.editFlag && (
        <>
          {' '}
          •{' '}
          <button className={styles.toggleHistory} onClick={props.onHistoryClick}>
            изменён
          </button>
        </>
      )}
    </div>
  )
})
