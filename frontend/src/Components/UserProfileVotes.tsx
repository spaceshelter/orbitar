import React, { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import { appendVoteFeedPage, useVoteFeedPages } from '../API/use/useVoteFeedPages'
import { getVoteEventKey, UserVoteFeedEvent, UserVotesMineResult } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
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

// Key groups by their first (newest) event only: appending a page extends a group's
// tail (possibly changing its kind from 'single'), so a first-event key stays stable
// and React reconciles children instead of remounting the whole section (heavy here,
// as every event mounts a full post/comment component). First events are unique per
// group because every event starts at most one group.
const getGroupKey = (group: VoteFeedGroup) => getVoteEventKey(group.events[0])

const mergeMinePages = (current: UserVotesMineResult, next: UserVotesMineResult): UserVotesMineResult => ({
  ...appendVoteFeedPage(current, next),
  entities: {
    posts: { ...current.entities.posts, ...next.entities.posts },
    comments: { ...current.entities.comments, ...next.entities.comments },
    parentComments: { ...current.entities.parentComments, ...next.entities.parentComments },
  },
})

const updateRecord = <T,>(record: Record<number, T>, id: number, changes: Partial<T>): Record<number, T> =>
  record[id] ? { ...record, [id]: { ...record[id], ...changes } } : record

function MineVotesFeed() {
  const api = useAPI()
  const { userInfo } = useAppState()

  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter(
    (value): Record<string, string> => (value ? { tab: 'mine', filter: value } : { tab: 'mine' }),
  )

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => api.userAPI.userVotes(filter || '', cursor, perpage, signal),
    [api.userAPI, filter],
  )
  // Previous results stay on screen while only the filter changes: at a 500ms query
  // budget a too-heavy filter is a normal outcome, and wiping the feed before every
  // keystroke's request would flash it away.
  const { feed, setFeed, loading, loadingMore, error, loadMoreError, loadMore } = useVoteFeedPages(fetchPage, {
    merge: mergeMinePages,
    timeoutError: 'Фильтр оказался слишком тяжёлым и не уложился в лимит времени — уточните запрос.',
    keepWhileReloading: true,
  })
  const events = feed?.events
  const nextCursor = feed?.nextCursor

  const groups = useMemo(() => groupVoteFeedEvents(events || []), [events])

  const updateVoteEvent = (event: UserVoteFeedEvent, rating: number, vote?: number) => {
    const key = getVoteEventKey(event)
    const nextVote = vote ?? 0
    setFeed((currentFeed) => {
      if (!currentFeed) {
        return currentFeed
      }

      if (nextVote === 0) {
        return {
          ...currentFeed,
          events: currentFeed.events.filter((currentEvent) => getVoteEventKey(currentEvent) !== key),
        }
      }

      const updatedEvents = currentFeed.events.map((currentEvent) => {
        if (getVoteEventKey(currentEvent) !== key) {
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
                          <div className={styles.event} key={getVoteEventKey(event)}>
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
