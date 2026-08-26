import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import {
  UserVoteFeedEvent,
  UserVotesDirection,
  UserVotesMineResult,
  UserVotesReceivedResult,
  UserVotesResult,
} from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import { pluralize } from '../Utils/utils'
import { groupVoteFeedEvents, VoteFeedGroup } from '../Utils/voteFeedGroups'
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
const emptyUsers: Record<number, UserInfo> = {}

const getTab = (searchParams: URLSearchParams): UserVotesDirection =>
  searchParams.get('tab') === 'received' ? 'received' : 'mine'

const getEventKey = (event: UserVoteFeedEvent) => `${event.type}:${event.entityId}:${event.voterId}`

// Key groups by their first (newest) event only: appending a page extends a group's
// tail (possibly changing its kind from 'single'), so a first-event key stays stable
// and React reconciles children instead of remounting the whole section (heavy for
// `mine`, which mounts full post/comment components). First events are unique per
// group because every event starts at most one group.
const getGroupKey = (group: VoteFeedGroup) => getEventKey(group.events[0])

const getUser = (users: Record<number, UserInfo>, userId?: number) => (userId ? users[userId] : undefined)

const getVoteText = (vote: number) => (vote > 0 ? `+${vote}` : String(vote))

const getVoteClassName = (vote: number) =>
  `${styles.voteValue} ${vote > 0 ? styles.voteValuePlus : vote < 0 ? styles.voteValueMinus : styles.voteValueZero}`

const getScoreClassName = (rating: number) =>
  `${styles.subjectRatingValue} ${
    rating > 0 ? styles.voteValuePlus : rating < 0 ? styles.voteValueMinus : styles.voteValueZero
  }`

const getEventRating = (event: UserVoteFeedEvent, feed: UserVotesReceivedResult) => {
  if (event.type === 'post') {
    return feed.subjects.posts[event.entityId]?.rating ?? 0
  }
  if (event.type === 'comment') {
    return feed.subjects.comments[event.entityId]?.rating ?? 0
  }
  return feed.users[event.entityId]?.karma ?? 0
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

// The 72-char budget mirrors the backend's RECEIVED_LABEL_MAX_CHARS; both slice
// over code points so an emoji on the boundary is not cut in half.
const getCompactText = (text?: string, limit = 72) => {
  const compact = (text || '').replace(/\s+/g, ' ').trim()

  if (!compact) {
    return ''
  }

  const characters = Array.from(compact)
  if (characters.length <= limit) {
    return compact
  }

  return `${characters.slice(0, limit).join('').trim()}...`
}

const getPostSubjectText = (postId: number, label: string) => (label ? `пост #${postId}: ${label}` : `пост #${postId}`)

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

const mergeVoteFeedResults = (current: UserVotesResult, next: UserVotesResult): UserVotesResult => {
  if (current.direction !== next.direction) {
    // Unreachable through the UI (a tab change resets the feed and aborts load-more);
    // surface a programming error in development instead of silently dropping the page.
    if (process.env.NODE_ENV !== 'production') {
      console.error('Vote feed direction mismatch on merge', current.direction, next.direction)
    }
    return current
  }

  const knownEventKeys = new Set(current.events.map(getEventKey))
  const nextEvents = next.events.filter((event) => {
    const key = getEventKey(event)
    if (knownEventKeys.has(key)) {
      return false
    }
    knownEventKeys.add(key)
    return true
  })
  const base = {
    events: [...current.events, ...nextEvents],
    users: { ...current.users, ...next.users },
    hasMore: next.hasMore,
    nextCursor: next.nextCursor,
  }

  if (current.direction === 'mine' && next.direction === 'mine') {
    return {
      ...base,
      direction: 'mine',
      entities: {
        posts: { ...current.entities.posts, ...next.entities.posts },
        comments: { ...current.entities.comments, ...next.entities.comments },
        parentComments: { ...current.entities.parentComments, ...next.entities.parentComments },
        postTitles: { ...current.entities.postTitles, ...next.entities.postTitles },
      },
    }
  }

  if (current.direction === 'received' && next.direction === 'received') {
    return {
      ...base,
      direction: 'received',
      subjects: {
        posts: { ...current.subjects.posts, ...next.subjects.posts },
        comments: { ...current.subjects.comments, ...next.subjects.comments },
      },
    }
  }

  // Unreachable: directions are equal above, but TypeScript cannot narrow the pair.
  return current
}

const updateRecord = <T,>(record: Record<number, T>, id: number, changes: Partial<T>): Record<number, T> =>
  record[id] ? { ...record, [id]: { ...record[id], ...changes } } : record

export default function UserProfileVotes() {
  const api = useAPI()
  const { userInfo } = useAppState()
  const sessionUserId = userInfo?.id
  const [searchParams] = useSearchParams()
  const tab = getTab(searchParams)
  const [feed, setFeed] = useState<UserVotesResult>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [loadMoreError, setLoadMoreError] = useState<string>()
  const loadMoreAbortControllerRef = useRef<AbortController>()
  const events = feed?.events
  const users = feed?.users || emptyUsers
  const nextCursor = feed?.nextCursor
  const feedDirection = feed?.direction || tab
  const mineFeed: UserVotesMineResult | undefined = feed?.direction === 'mine' ? feed : undefined
  const receivedFeed: UserVotesReceivedResult | undefined = feed?.direction === 'received' ? feed : undefined

  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter(
    (value): Record<string, string> => (value ? { tab, filter: value } : { tab }),
  )

  useEffect(() => {
    const abortController = new AbortController()
    loadMoreAbortControllerRef.current?.abort()
    loadMoreAbortControllerRef.current = undefined
    setLoading(true)
    setLoadingMore(false)
    setFeed(undefined)
    setError(undefined)
    setLoadMoreError(undefined)
    api.userAPI
      .userVotes(tab, filter || '', undefined, perpage, abortController.signal)
      .then((result) => {
        if (abortController.signal.aborted) {
          return
        }
        setFeed(result)
        setError(undefined)
        setLoading(false)
      })
      .catch(() => {
        if (abortController.signal.aborted) {
          return
        }
        setError('Не удалось загрузить ленту оценок')
        setLoading(false)
      })

    return () => {
      abortController.abort()
      loadMoreAbortControllerRef.current?.abort()
      loadMoreAbortControllerRef.current = undefined
    }
  }, [api.userAPI, filter, sessionUserId, tab])

  const loadMore = () => {
    if (!nextCursor || loadingMore) {
      return
    }
    const abortController = new AbortController()
    loadMoreAbortControllerRef.current?.abort()
    loadMoreAbortControllerRef.current = abortController
    setLoadingMore(true)
    setLoadMoreError(undefined)
    api.userAPI
      .userVotes(tab, filter || '', nextCursor, perpage, abortController.signal)
      .then((result) => {
        if (abortController.signal.aborted) {
          return
        }
        setFeed((currentFeed) => (currentFeed ? mergeVoteFeedResults(currentFeed, result) : result))
        setLoadingMore(false)
        loadMoreAbortControllerRef.current = undefined
      })
      .catch(() => {
        if (abortController.signal.aborted) {
          return
        }
        setLoadMoreError('Не удалось загрузить ещё оценки')
        setLoadingMore(false)
        loadMoreAbortControllerRef.current = undefined
      })
  }

  const groups = useMemo(() => groupVoteFeedEvents(events || [], feedDirection), [events, feedDirection])
  const receivedTimeGroups = useMemo(() => {
    const buckets = new Map<VoteFeedGroup, ReturnType<typeof getVoteTimeGroups>>()
    if (feedDirection === 'received') {
      for (const group of groups) {
        buckets.set(group, getVoteTimeGroups(group.events))
      }
    }
    return buckets
  }, [groups, feedDirection])

  const updateVoteEvent = (event: UserVoteFeedEvent, rating: number, vote?: number) => {
    const key = getEventKey(event)
    const nextVote = vote ?? 0
    setFeed((currentFeed) => {
      if (!currentFeed) {
        return currentFeed
      }

      if (nextVote === 0) {
        return {
          ...currentFeed,
          events: currentFeed.events.filter((currentEvent) => getEventKey(currentEvent) !== key),
        }
      }

      const updatedEvents = currentFeed.events.map((currentEvent) => {
        if (getEventKey(currentEvent) !== key) {
          return currentEvent
        }

        return {
          ...currentEvent,
          vote: nextVote,
        }
      })

      if (event.type === 'user') {
        return {
          ...currentFeed,
          events: updatedEvents,
          users: updateRecord(currentFeed.users, event.entityId, { karma: rating, vote: nextVote }),
        }
      }

      // Only `mine` renderers mount a RatingSwitch, so votes can change only there;
      // the guard is for TypeScript narrowing, not a reachable branch.
      if (currentFeed.direction !== 'mine') {
        return currentFeed
      }

      if (event.type === 'post') {
        return {
          ...currentFeed,
          events: updatedEvents,
          entities: {
            ...currentFeed.entities,
            posts: updateRecord(currentFeed.entities.posts, event.entityId, { rating, vote: nextVote }),
          },
        }
      }

      return {
        ...currentFeed,
        events: updatedEvents,
        entities: {
          ...currentFeed.entities,
          comments: updateRecord(currentFeed.entities.comments, event.entityId, { rating, vote: nextVote }),
        },
      }
    })
  }

  const renderGroupHeader = (group: VoteFeedGroup) => {
    if (feedDirection !== 'received' && group.kind === 'single') {
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
    if (!receivedFeed) {
      return null
    }

    if (event.type === 'post') {
      const subject = receivedFeed.subjects.posts[event.entityId]
      if (!subject) {
        return null
      }
      return (
        <PostLink className={styles.subjectLink} post={subject}>
          {getPostSubjectText(subject.id, getCompactText(subject.label))}
        </PostLink>
      )
    }

    if (event.type === 'comment') {
      const subject = receivedFeed.subjects.comments[event.entityId]
      if (!subject) {
        return null
      }
      const postTitle = getCompactText(subject.postTitle)
      return (
        <PostLink
          className={styles.subjectLink}
          post={{ id: subject.postId, site: subject.site }}
          commentId={subject.id}
        >
          комментарий #{subject.id} в посте #{subject.postId}
          {postTitle ? `: ${postTitle}` : ''}
        </PostLink>
      )
    }

    const user = receivedFeed.users[event.entityId]
    if (!user) {
      return null
    }
    return (
      <span className={styles.subjectInline}>
        профиль <Username className={styles.voteUsername} user={user} />
      </span>
    )
  }

  const renderReceivedGroupSubject = (group: VoteFeedGroup, sameEntity: boolean) => {
    const firstEvent = group.events[0]
    if (!firstEvent || !receivedFeed) {
      return null
    }

    if (sameEntity) {
      const rating = getEventRating(firstEvent, receivedFeed)
      return (
        <div className={styles.groupSubject}>
          <div className={styles.subjectMain}>{renderReceivedEventSubject(firstEvent)}</div>
          <div className={styles.subjectRating}>
            рейтинг <span className={getScoreClassName(rating)}>{rating}</span>
          </div>
        </div>
      )
    }

    return null
  }

  const renderReceivedVoteRow = (event: UserVoteFeedEvent, group: VoteFeedGroup, sameEntity: boolean) => {
    const voter = getUser(users, event.voterId)
    const rating = receivedFeed ? getEventRating(event, receivedFeed) : 0

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
      <div className={styles.voteTimeGroup} key={`${timeGroup.bucket}:${getEventKey(timeGroup.events[0])}`}>
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
      !!firstEvent &&
      group.events.every((event) => event.type === firstEvent.type && event.entityId === firstEvent.entityId)
    const timeGroups = receivedTimeGroups.get(group) || []

    return (
      <section key={getGroupKey(group)}>
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

  const renderPost = (event: UserVoteFeedEvent) => {
    if (event.type !== 'post' || !mineFeed) {
      return null
    }
    const post = mineFeed.entities.posts[event.entityId]
    if (!post) {
      return null
    }
    const handleChange = (_id: number, changes: Partial<PostInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, changes.rating ?? post.rating, changes.vote)
      }
    }

    return <PostComponent post={post} showSite={true} onChange={handleChange} autoCut={LARGE_AUTO_CUT} />
  }

  const renderComment = (event: UserVoteFeedEvent) => {
    if (event.type !== 'comment' || !mineFeed) {
      return null
    }
    const comment = mineFeed.entities.comments[event.entityId]
    if (!comment) {
      return null
    }
    const parentComment = comment.parentComment ? mineFeed.entities.parentComments[comment.parentComment] : undefined
    const handleVote = (_id: number, changes: Partial<CommentInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, changes.rating ?? comment.rating, changes.vote)
      }
    }

    return (
      <CommentComponent
        idx={parentComment ? 1 : 0}
        parent={parentComment}
        currentUsername={userInfo?.username}
        comment={comment}
        showSite={comment.site !== 'main'}
        onVote={handleVote}
      />
    )
  }

  const renderUser = (event: UserVoteFeedEvent) => {
    if (event.type !== 'user' || !mineFeed) {
      return null
    }
    const user = mineFeed.users[event.entityId]
    if (!user) {
      return null
    }
    const handleVote = (karma: number, vote?: number, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, karma, vote)
      }
    }

    return (
      <div className={styles.userEvent}>
        <div className={styles.userInfo}>
          <Username user={user} />
          <span>карма</span>
        </div>
        <RatingSwitch
          type='user'
          id={user.id}
          double={true}
          rating={{ vote: event.vote, value: user.karma }}
          onVote={handleVote}
        />
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
      <div className={feedStyles.filter}>
        <input
          ref={filterInputRef}
          onKeyUp={handleFilterChange}
          onChange={handleFilterChange}
          placeholder='фильтровать'
          aria-label='Фильтр оценок'
          type='search'
          defaultValue={defaultFilter}
        />
      </div>
      {/* Outside the aria-busy subtree, otherwise assistive tech defers its updates;
          a status region announces its text content, so it must carry some. */}
      <span className={styles.srOnly} role='status' aria-live='polite'>
        {loading
          ? 'Загружаются оценки'
          : error
            ? ''
            : !events || events.length === 0
              ? 'Оценок пока нет'
              : `Показано ${pluralize(events.length, ['оценка', 'оценки', 'оценок'])}`}
      </span>
      <div className={feedStyles.feed} aria-busy={loading || loadingMore}>
        {loading ? (
          <div className={feedStyles.loading}></div>
        ) : (
          <>
            {error && (
              <div className={feedStyles.error} role='alert'>
                {error}
              </div>
            )}
            {!error && events && events.length === 0 && <div className={styles.empty}>Оценок пока нет.</div>}
            {!error && groups.length > 0 && (
              <div className={styles.groups}>
                {groups.map((group) => {
                  if (receivedFeed) {
                    return renderReceivedGroup(group)
                  }

                  const header = renderGroupHeader(group)
                  return (
                    <section key={getGroupKey(group)}>
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
            {!error && loadMoreError && (
              <div className={feedStyles.error} role='alert'>
                {loadMoreError}
              </div>
            )}
            {/* Gate on nextCursor, the one field loadMore actually consumes. */}
            {!error && nextCursor && (
              <div className={styles.loadMore}>
                <Button variant='ghost' onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Загружается...' : loadMoreError ? 'Повторить' : 'Показать ещё'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
