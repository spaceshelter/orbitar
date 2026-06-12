import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import { UserVoteFeedEvent, UserVotesDirection } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import { htmlToPlainText, pluralize } from '../Utils/utils'
import { getVoteFeedEventEntityId, groupVoteFeedEvents, VoteFeedGroup } from '../Utils/voteFeedGroups'
import CommentComponent from './CommentComponent'
import { LARGE_AUTO_CUT } from './ContentComponent'
import { formatRelativeAgeBucket } from './DateComponent'
import PostComponent from './PostComponent'
import PostLink from './PostLink'
import RatingSwitch from './RatingSwitch'
import { useProfileFeedFilter } from './useProfileFeedFilter'
import Username from './Username'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './UserProfileVotes.module.scss'

const perpage = 20

const getTab = (searchParams: URLSearchParams): UserVotesDirection =>
  searchParams.get('tab') === 'received' ? 'received' : 'mine'

const getEventKey = (event: UserVoteFeedEvent) => `${event.type}:${getVoteFeedEventEntityId(event)}:${event.voterId}`

const getGroupKey = (group: VoteFeedGroup) =>
  `${group.kind}:${group.latestAt.toISOString()}:${group.events.map(getEventKey).join('|')}`

const getUser = (users: Record<number, UserInfo>, userId?: number) => (userId ? users[userId] : undefined)

const receivedVotingDisabledTitle = 'Здесь показана эта оценка; число посередине — общий рейтинг.'

const getVoteText = (vote: number) => (vote > 0 ? `+${vote}` : String(vote))

const getVoteClassName = (vote: number) =>
  `${styles.voteValue} ${vote > 0 ? styles.voteValuePlus : vote < 0 ? styles.voteValueMinus : styles.voteValueZero}`

const getScoreClassName = (rating: number) =>
  `${styles.subjectRatingValue} ${
    rating > 0 ? styles.voteValuePlus : rating < 0 ? styles.voteValueMinus : styles.voteValueZero
  }`

const getEventEntityKey = (event: UserVoteFeedEvent) => `${event.type}:${getVoteFeedEventEntityId(event)}`

const getEventRating = (event: UserVoteFeedEvent) => {
  if (event.type === 'post') {
    return event.post.rating
  }
  if (event.type === 'comment') {
    return event.comment.rating
  }
  return event.user.karma
}

const getGroupEntityName = (event?: UserVoteFeedEvent) => {
  if (event?.type === 'post') {
    return 'поста'
  }
  if (event?.type === 'comment') {
    return 'комментария'
  }
  return 'профиля'
}

const getCompactText = (text?: string, limit = 72) => {
  const compact = htmlToPlainText(text || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!compact) {
    return ''
  }

  if (compact.length <= limit) {
    return compact
  }

  return `${compact.slice(0, limit).trim()}...`
}

const getPostLinkText = (postId: number, title?: string) => {
  const label = getCompactText(title)
  return label ? `пост #${postId}: ${label}` : `пост #${postId}`
}

const getPostSubjectText = (post: PostInfo) => {
  const label = getCompactText(post.title) || getCompactText(post.content)
  return label ? `пост #${post.id}: ${label}` : `пост #${post.id}`
}

const renderGroupUserLink = (user?: UserInfo) => {
  if (!user) {
    return <span>пользователя</span>
  }

  return (
    <Link className={styles.groupUserLink} to={`/u/${user.username}`}>
      {user.username}
    </Link>
  )
}

const getVoteTimeGroups = (events: UserVoteFeedEvent[]) =>
  events.reduce<Array<{ bucket: string; events: UserVoteFeedEvent[] }>>((acc, event) => {
    const bucket = formatRelativeAgeBucket(event.votedAt)
    const lastGroup = acc[acc.length - 1]

    if (lastGroup?.bucket === bucket) {
      lastGroup.events.push(event)
    } else {
      acc.push({ bucket, events: [event] })
    }

    return acc
  }, [])

type UserProfileVotesProps = {
  basePath: string
  queryStringParams?: Record<string, string>
  showTabs?: boolean
}

export default function UserProfileVotes({
  basePath,
  queryStringParams: persistentQueryStringParams = {},
  showTabs = true,
}: UserProfileVotesProps) {
  const api = useAPI()
  const { userInfo } = useAppState()
  const [searchParams] = useSearchParams()
  const tab = getTab(searchParams)
  const [events, setEvents] = useState<UserVoteFeedEvent[]>()
  const [users, setUsers] = useState<Record<number, UserInfo>>({})
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()

  const buildSearchParams = (nextTab: UserVotesDirection, nextFilter: string) => {
    const params: Record<string, string> = { ...persistentQueryStringParams, tab: nextTab }
    if (nextFilter) {
      params.filter = nextFilter
    }
    return params
  }

  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter((value) =>
    buildSearchParams(tab, value),
  )

  const tabUrl = (nextTab: UserVotesDirection) => {
    const params = new URLSearchParams(buildSearchParams(nextTab, filter))
    return `${basePath}?${params.toString()}`
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEvents(undefined)
    api.userAPI
      .userVotes(tab, filter || '', undefined, perpage)
      .then((result) => {
        if (cancelled) {
          return
        }
        setEvents(result.events)
        setUsers(result.users)
        setHasMore(result.hasMore)
        setNextCursor(result.nextCursor)
        setError(undefined)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не удалось загрузить ленту оценок')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [api.userAPI, filter, tab])

  const loadMore = () => {
    if (!nextCursor || loadingMore) {
      return
    }
    setLoadingMore(true)
    api.userAPI
      .userVotes(tab, filter || '', nextCursor, perpage)
      .then((result) => {
        setEvents((currentEvents) => {
          const known = new Set((currentEvents || []).map(getEventKey))
          return [...(currentEvents || []), ...result.events.filter((event) => !known.has(getEventKey(event)))]
        })
        setUsers((currentUsers) => ({ ...currentUsers, ...result.users }))
        setHasMore(result.hasMore)
        setNextCursor(result.nextCursor)
        setLoadingMore(false)
      })
      .catch(() => {
        setError('Не удалось загрузить ленту оценок')
        setLoadingMore(false)
      })
  }

  const groups = useMemo(() => groupVoteFeedEvents(events || [], tab), [events, tab])

  const updateVoteEvent = (event: UserVoteFeedEvent, rating: number, vote?: number) => {
    const key = getEventKey(event)
    setEvents((currentEvents) =>
      currentEvents?.map((currentEvent) => {
        if (getEventKey(currentEvent) !== key) {
          return currentEvent
        }

        if (currentEvent.type === 'post') {
          return {
            ...currentEvent,
            vote: vote ?? 0,
            post: {
              ...currentEvent.post,
              rating,
              vote,
            },
          }
        }

        if (currentEvent.type === 'comment') {
          return {
            ...currentEvent,
            vote: vote ?? 0,
            comment: {
              ...currentEvent.comment,
              rating,
              vote,
            },
          }
        }

        return {
          ...currentEvent,
          vote: vote ?? 0,
          user: {
            ...currentEvent.user,
            karma: rating,
            vote,
          },
        }
      }),
    )
  }

  const renderGroupHeader = (group: VoteFeedGroup) => {
    if (tab !== 'received' && group.kind === 'single') {
      return null
    }

    if (group.kind === 'voter') {
      const voter = getUser(users, group.voterId)
      return (
        <span className={styles.groupTitle}>
          <span className={styles.groupActor}>
            <span>Оценки от</span>
            {renderGroupUserLink(voter)}
          </span>
        </span>
      )
    }

    if (group.kind === 'target-author') {
      const target = getUser(users, group.targetUserId)
      return (
        <span className={styles.groupTitle}>
          <span className={styles.groupActor}>
            <span>Материалы</span>
            {renderGroupUserLink(target)}
          </span>
        </span>
      )
    }

    if (group.kind === 'context-post') {
      return <span className={styles.groupTitle}>Оценки в одном обсуждении</span>
    }

    const firstEvent = group.events[0]
    return <span className={styles.groupTitle}>Оценки {getGroupEntityName(firstEvent)}</span>
  }

  const renderReceivedEventSubject = (event: UserVoteFeedEvent) => {
    if (event.type === 'post') {
      return (
        <PostLink className={styles.subjectLink} post={event.post}>
          {getPostSubjectText(event.post)}
        </PostLink>
      )
    }

    if (event.type === 'comment') {
      const postTitle = getCompactText(event.postTitle)
      return (
        <PostLink className={styles.subjectLink} post={event.comment.postLink} commentId={event.comment.id}>
          комментарий #{event.comment.id} в посте #{event.comment.postLink.id}
          {postTitle ? `: ${postTitle}` : ''}
        </PostLink>
      )
    }

    return (
      <span className={styles.subjectInline}>
        профиль <Username className={styles.voteUsername} user={event.user} />
      </span>
    )
  }

  const renderReceivedGroupSubject = (group: VoteFeedGroup, sameEntity: boolean) => {
    const firstEvent = group.events[0]
    if (!firstEvent) {
      return null
    }

    if (sameEntity) {
      const rating = getEventRating(firstEvent)
      return (
        <div className={styles.groupSubject}>
          <div className={styles.subjectMain}>{renderReceivedEventSubject(firstEvent)}</div>
          <div className={styles.subjectRating}>
            рейтинг <span className={getScoreClassName(rating)}>{rating}</span>
          </div>
        </div>
      )
    }

    if (group.kind === 'context-post') {
      const postLink =
        firstEvent.type === 'post'
          ? firstEvent.post
          : firstEvent.type === 'comment'
            ? firstEvent.comment.postLink
            : undefined
      const postTitle =
        firstEvent.type === 'post'
          ? firstEvent.post.title
          : firstEvent.type === 'comment'
            ? firstEvent.postTitle
            : undefined
      if (postLink) {
        return (
          <div className={styles.groupSubject}>
            <div className={styles.subjectMain}>
              обсуждение{' '}
              <PostLink className={styles.subjectLink} post={postLink}>
                {getPostLinkText(postLink.id, postTitle)}
              </PostLink>
            </div>
          </div>
        )
      }
    }

    return null
  }

  const renderReceivedVoteRow = (event: UserVoteFeedEvent, group: VoteFeedGroup, sameEntity: boolean) => {
    const voter = getUser(users, event.voterId)
    const rating = getEventRating(event)

    return (
      <div className={styles.voteRow} key={getEventKey(event)}>
        <span className={getVoteClassName(event.vote)}>{getVoteText(event.vote)}</span>
        <div className={styles.voteRowBody}>
          <div className={styles.voteRowMain}>
            {!sameEntity && <span className={styles.voteTarget}>{renderReceivedEventSubject(event)}</span>}
            {group.kind !== 'voter' && (
              <span className={styles.voteVoter}>
                от {voter ? <Username className={styles.voteUsername} user={voter} /> : 'пользователя'}
              </span>
            )}
          </div>
          {!sameEntity && (
            <div className={styles.voteRowMeta}>
              рейтинг <span className={getScoreClassName(rating)}>{rating}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderReceivedTimeGroup = (
    group: VoteFeedGroup,
    timeGroup: { bucket: string; events: UserVoteFeedEvent[] },
    sameEntity: boolean,
  ) => {
    return (
      <div className={styles.voteTimeGroup} key={`${timeGroup.bucket}:${timeGroup.events.map(getEventKey).join('|')}`}>
        <div className={styles.voteTimeHeader}>{timeGroup.bucket}</div>
        <div className={styles.voteRows}>
          {timeGroup.events.map((event) => renderReceivedVoteRow(event, group, sameEntity))}
        </div>
      </div>
    )
  }

  const renderReceivedGroup = (group: VoteFeedGroup) => {
    const header = renderGroupHeader(group)
    const firstEvent = group.events[0]
    const sameEntity =
      !!firstEvent && group.events.every((event) => getEventEntityKey(event) === getEventEntityKey(firstEvent))
    const timeGroups = getVoteTimeGroups(group.events)

    return (
      <section key={getGroupKey(group)} className={styles.group}>
        <div className={styles.groupHeader}>
          {header}
          <span className={styles.groupCount}>{pluralize(group.events.length, ['оценка', 'оценки', 'оценок'])}</span>
        </div>
        {renderReceivedGroupSubject(group, sameEntity)}
        <div className={styles.voteTimeGroups}>
          {timeGroups.map((timeGroup) => renderReceivedTimeGroup(group, timeGroup, sameEntity))}
        </div>
      </section>
    )
  }

  const renderPost = (event: Extract<UserVoteFeedEvent, { type: 'post' }>) => {
    const handleChange = (_id: number, post: Partial<PostInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, post.rating ?? event.post.rating, post.vote)
      }
    }

    const post =
      tab === 'received'
        ? {
            ...event.post,
            vote: event.vote,
          }
        : event.post

    return (
      <PostComponent
        post={post}
        showSite={true}
        votingDisabled={tab === 'received'}
        votingDisabledTitle={receivedVotingDisabledTitle}
        onChange={tab === 'mine' ? handleChange : undefined}
        autoCut={LARGE_AUTO_CUT}
      />
    )
  }

  const renderComment = (event: Extract<UserVoteFeedEvent, { type: 'comment' }>) => {
    const handleVote = (_id: number, comment: Partial<CommentInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, comment.rating ?? event.comment.rating, comment.vote)
      }
    }

    const comment =
      tab === 'received'
        ? {
            ...event.comment,
            vote: event.vote,
          }
        : event.comment

    return (
      <CommentComponent
        idx={event.parentComment ? 1 : 0}
        parent={event.parentComment}
        currentUsername={userInfo?.username}
        comment={comment}
        showSite={event.comment.site !== 'main'}
        votingDisabled={tab === 'received'}
        votingDisabledTitle={receivedVotingDisabledTitle}
        onVote={tab === 'mine' ? handleVote : undefined}
      />
    )
  }

  const renderUser = (event: Extract<UserVoteFeedEvent, { type: 'user' }>) => {
    const handleVote = (karma: number, vote?: number, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, karma, vote)
      }
    }

    return (
      <div className={styles.userEvent}>
        <div className={styles.userInfo}>
          <Username user={event.user} />
          <span>карма</span>
        </div>
        {tab === 'mine' ? (
          <RatingSwitch
            type='user'
            id={event.user.id}
            double={true}
            rating={{ vote: event.vote, value: event.user.karma }}
            onVote={handleVote}
          />
        ) : (
          <RatingSwitch
            type='user'
            id={event.user.id}
            double={true}
            rating={{ vote: event.vote, value: event.user.karma }}
            votingDisabled={true}
            votingDisabledTitle={receivedVotingDisabledTitle}
          />
        )}
      </div>
    )
  }

  const renderEvent = (event: UserVoteFeedEvent) => {
    if (event.type === 'post') {
      return renderPost(event)
    }
    if (event.type === 'comment') {
      return renderComment(event)
    }
    return renderUser(event)
  }

  return (
    <div className={feedStyles.container}>
      {showTabs && (
        <div className={styles.tabs}>
          <Link className={`${styles.tab} ${tab === 'received' ? styles.tabActive : ''}`} to={tabUrl('received')}>
            Оценки мне
          </Link>
          <Link className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} to={tabUrl('mine')}>
            Мои оценки
          </Link>
        </div>
      )}
      <div className={feedStyles.filter}>
        <input
          ref={filterInputRef}
          onKeyUp={handleFilterChange}
          onChange={handleFilterChange}
          placeholder={'фильтровать'}
          type='search'
          defaultValue={defaultFilter}
        />
      </div>
      <div className={feedStyles.feed}>
        {loading ? (
          <div className={feedStyles.loading}></div>
        ) : (
          <>
            {error && <div className={feedStyles.error}>{error}</div>}
            {!error && events && events.length === 0 && <div className={styles.empty}>Оценок пока нет.</div>}
            {!error && groups.length > 0 && (
              <div className={styles.groups}>
                {groups.map((group) => {
                  if (tab === 'received') {
                    return renderReceivedGroup(group)
                  }

                  const header = renderGroupHeader(group)
                  return (
                    <section key={getGroupKey(group)} className={styles.group}>
                      {header && (
                        <div className={styles.groupHeader}>
                          {header}
                          <span className={styles.groupCount}>
                            {pluralize(group.events.length, ['оценка', 'оценки', 'оценок'])}
                          </span>
                        </div>
                      )}
                      <div className={styles.events}>
                        {group.events.map((event) => (
                          <div className={styles.event} key={getEventKey(event)}>
                            {renderEvent(event)}
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
            {!error && hasMore && (
              <div className={styles.loadMore}>
                <Button variant='ghost' onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Загружается...' : 'Показать ещё'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
