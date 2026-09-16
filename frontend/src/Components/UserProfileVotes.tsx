import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import { APIError } from '../API/APIBase'
import { UserVoteFeedEvent, UserVotesMineResult } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import { pluralize } from '../Utils/utils'
import { groupVoteFeedEvents, VoteFeedGroup } from '../Utils/voteFeedGroups'
import CommentComponent from './CommentComponent'
import { LARGE_AUTO_CUT } from './ContentComponent'
import PostComponent from './PostComponent'
import RatingSwitch from './RatingSwitch'
import ReceivedVotesDigest from './ReceivedVotesDigest'
import { useProfileFeedFilter } from './useProfileFeedFilter'
import Username from './Username'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './UserProfileVotes.module.scss'

const perpage = 20
const emptyUsers: Record<number, UserInfo> = {}

const getEventKey = (event: UserVoteFeedEvent) => `${event.type}:${event.entityId}:${event.voterId}`

// Key groups by their first (newest) event only: appending a page extends a group's
// tail (possibly changing its kind from 'single'), so a first-event key stays stable
// and React reconciles children instead of remounting the whole section (heavy here,
// as every event mounts a full post/comment component). First events are unique per
// group because every event starts at most one group.
const getGroupKey = (group: VoteFeedGroup) => getEventKey(group.events[0])

const getUser = (users: Record<number, UserInfo>, userId?: number) => (userId ? users[userId] : undefined)

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

const mergeVoteFeedResults = (current: UserVotesMineResult, next: UserVotesMineResult): UserVotesMineResult => {
  const knownEventKeys = new Set(current.events.map(getEventKey))
  const nextEvents = next.events.filter((event) => {
    const key = getEventKey(event)
    if (knownEventKeys.has(key)) {
      return false
    }
    knownEventKeys.add(key)
    return true
  })

  return {
    direction: 'mine',
    events: [...current.events, ...nextEvents],
    users: { ...current.users, ...next.users },
    entities: {
      posts: { ...current.entities.posts, ...next.entities.posts },
      comments: { ...current.entities.comments, ...next.entities.comments },
      parentComments: { ...current.entities.parentComments, ...next.entities.parentComments },
    },
    hasMore: next.hasMore,
    nextCursor: next.nextCursor,
  }
}

const updateRecord = <T,>(record: Record<number, T>, id: number, changes: Partial<T>): Record<number, T> =>
  record[id] ? { ...record, [id]: { ...record[id], ...changes } } : record

function MineVotesFeed() {
  const api = useAPI()
  const { userInfo } = useAppState()
  const sessionUserId = userInfo?.id
  const [feed, setFeed] = useState<UserVotesMineResult>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [loadMoreError, setLoadMoreError] = useState<string>()
  const loadMoreAbortControllerRef = useRef<AbortController>()
  const events = feed?.events
  const users = feed?.users || emptyUsers
  const nextCursor = feed?.nextCursor

  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter(
    (value): Record<string, string> => (value ? { tab: 'mine', filter: value } : { tab: 'mine' }),
  )

  const feedContextRef = useRef<string>()

  useEffect(() => {
    const abortController = new AbortController()
    loadMoreAbortControllerRef.current?.abort()
    loadMoreAbortControllerRef.current = undefined
    setLoading(true)
    setLoadingMore(false)
    // Keep the previous results on screen while only the filter changes: at a
    // 500ms query budget a too-heavy filter is a normal outcome, and wiping the
    // feed before every keystrokes' request would flash it away. A different
    // session user is a different feed - drop it.
    const feedContext = `${sessionUserId ?? ''}`
    if (feedContextRef.current !== feedContext) {
      setFeed(undefined)
    }
    feedContextRef.current = feedContext
    setError(undefined)
    setLoadMoreError(undefined)
    api.userAPI
      .userVotes(filter || '', undefined, perpage, abortController.signal)
      .then((result) => {
        if (abortController.signal.aborted) {
          return
        }
        setFeed(result)
        setError(undefined)
        setLoading(false)
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          return
        }
        setError(
          err instanceof APIError && err.code === 'filter-timeout'
            ? 'Фильтр оказался слишком тяжёлым и не уложился в лимит времени — уточните запрос.'
            : 'Не удалось загрузить ленту оценок',
        )
        setLoading(false)
      })

    return () => {
      abortController.abort()
      loadMoreAbortControllerRef.current?.abort()
      loadMoreAbortControllerRef.current = undefined
    }
  }, [api.userAPI, filter, sessionUserId])

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
      .userVotes(filter || '', nextCursor, perpage, abortController.signal)
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

  const groups = useMemo(() => groupVoteFeedEvents(events || []), [events])

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

    return null
  }

  const renderPost = (event: UserVoteFeedEvent) => {
    if (event.type !== 'post' || !feed) {
      return null
    }
    const post = feed.entities.posts[event.entityId]
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
    if (event.type !== 'comment' || !feed) {
      return null
    }
    const comment = feed.entities.comments[event.entityId]
    if (!comment) {
      return null
    }
    const parentComment = comment.parentComment ? feed.entities.parentComments[comment.parentComment] : undefined
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
    if (event.type !== 'user' || !feed) {
      return null
    }
    const user = feed.users[event.entityId]
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
        {loading && !feed ? (
          <div className={feedStyles.loading}></div>
        ) : (
          <>
            {error && (
              <div className={feedStyles.error} role='alert'>
                {error}
              </div>
            )}
            {!error && events && events.length === 0 && <div className={styles.empty}>Оценок пока нет.</div>}
            {groups.length > 0 && (
              <div className={styles.groups}>
                {groups.map((group) => {
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

// «Мои оценки» and «Оценки мне» load and present votes differently (a post/comment
// feed with a text filter vs. a digest of discussions with type/sign/period filters),
// so the tab picks a whole component; switching tabs unmounts the other one and
// aborts its in-flight requests.
export default function UserProfileVotes() {
  const [searchParams] = useSearchParams()
  return searchParams.get('tab') === 'received' ? <ReceivedVotesDigest /> : <MineVotesFeed />
}
