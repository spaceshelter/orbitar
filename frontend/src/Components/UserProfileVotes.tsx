import React, { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import { useVoteFeedPages } from '../API/use/useVoteFeedPages'
import { getVoteEventKey, UserVoteFeedEvent } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { pluralize } from '../Utils/utils'
import { groupVoteFeedEvents } from '../Utils/voteFeedGroups'
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

const updateRecord = <T,>(record: Record<number, T>, id: number, changes: Partial<T>): Record<number, T> =>
  record[id] ? { ...record, [id]: { ...record[id], ...changes } } : record

function MineVotesFeed() {
  const api = useAPI()
  const { userInfo } = useAppState()

  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter(
    (value): Record<string, string> => (value ? { tab: 'mine', filter: value } : { tab: 'mine' }),
  )

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => api.userAPI.userVotes(filter, cursor, perpage, signal),
    [api.userAPI, filter],
  )
  // Results stay while only the filter changes: at a 500ms query budget a too-heavy filter is a normal
  // outcome, and wiping the feed before every keystroke's request would flash it away.
  const { feed, setFeed, loading, loadingMore, error, loadMoreError, loadMore } = useVoteFeedPages(fetchPage, {
    tables: 'entities',
    timeoutError: 'Фильтр оказался слишком тяжёлым и не уложился в лимит времени — уточните запрос.',
    keepWhileReloading: true,
  })
  const events = feed?.events
  const nextCursor = feed?.nextCursor

  const groups = useMemo(() => groupVoteFeedEvents(events || []), [events])

  const updateVoteEvent = (event: UserVoteFeedEvent, rating: number, vote = 0) => {
    const key = getVoteEventKey(event)
    const id = event.entityId
    setFeed((current) => {
      if (!current) return current
      if (!vote) return { ...current, events: current.events.filter((item) => getVoteEventKey(item) !== key) }
      const { users, entities } = current
      return {
        ...current,
        events: current.events.map((item) => (getVoteEventKey(item) === key ? { ...item, vote } : item)),
        users: event.type === 'user' ? updateRecord(users, id, { karma: rating, vote }) : users,
        entities: {
          ...entities,
          posts: event.type === 'post' ? updateRecord(entities.posts, id, { rating, vote }) : entities.posts,
          comments:
            event.type === 'comment' ? updateRecord(entities.comments, id, { rating, vote }) : entities.comments,
        },
      }
    })
  }

  const renderEvent = (event: UserVoteFeedEvent) => {
    if (!feed) return null
    // A vote is reported twice, optimistically and then confirmed; the feed follows the confirmed one.
    const onEntityVote =
      (rating: number) => (_id: number, changes: { rating?: number; vote?: number }, postApiCall?: boolean) =>
        postApiCall && updateVoteEvent(event, changes.rating ?? rating, changes.vote)

    if (event.type === 'post') {
      const post = feed.entities.posts[event.entityId]
      if (!post) return null
      return <PostComponent post={post} showSite={true} onChange={onEntityVote(post.rating)} autoCut={LARGE_AUTO_CUT} />
    }
    if (event.type === 'comment') {
      const comment = feed.entities.comments[event.entityId]
      if (!comment) return null
      const parent = comment.parentComment ? feed.entities.parentComments[comment.parentComment] : undefined
      return (
        <CommentComponent
          idx={parent ? 1 : 0}
          parent={parent}
          currentUsername={userInfo?.username}
          comment={comment}
          showSite={comment.site !== 'main'}
          onVote={onEntityVote(comment.rating)}
        />
      )
    }
    const user = feed.users[event.entityId]
    if (!user) return null
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
          onVote={(karma, vote, postApiCall) => postApiCall && updateVoteEvent(event, karma, vote)}
        />
      </div>
    )
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
                {groups.map((group) => (
                  // Keyed by the newest event: a next page only extends a run, so its rows stay mounted.
                  <section key={getVoteEventKey(group[0])}>
                    {group.length > 1 && (
                      <div className={styles.groupHeader}>
                        <span>Оценки в одном обсуждении</span>
                        <span className={styles.groupCount}>
                          {pluralize(group.length, ['оценка', 'оценки', 'оценок'])}
                        </span>
                      </div>
                    )}
                    {group.map((event) => (
                      <div className={styles.event} key={getVoteEventKey(event)}>
                        {renderEvent(event)}
                      </div>
                    ))}
                  </section>
                ))}
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

export default function UserProfileVotes() {
  const [searchParams] = useSearchParams()
  return searchParams.get('tab') === 'received' ? <ReceivedVotesDigest /> : <MineVotesFeed />
}
