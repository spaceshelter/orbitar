import { useCallback, useEffect, useRef, useState } from 'react'

import { useAPI, useAppState } from '../../AppState/AppState'
import { getPeriodSince, VotePeriod, VoteSign } from '../../Utils/receivedVotesDigest'
import { APIError } from '../APIBase'
import { ReceivedVotesQuery, ReceivedVoteType, UserVoteFeedEvent, UserVotesReceivedResult } from '../UserAPI'

const PAGE_SIZE = 200
// Periods up to a month follow the cursor on their own for this many pages; past
// that, and for a year or all time, pages load on demand and the oldest loaded
// section may be incomplete (the digest marks it).
const AUTO_FOLLOW_PAGES = 5

export type ReceivedVotesFilters = { type: 'all' | ReceivedVoteType; sign: VoteSign; period: VotePeriod }

const eventKey = (event: UserVoteFeedEvent) => `${event.type}:${event.entityId}:${event.voterId}`

const mergePages = (current: UserVotesReceivedResult, next: UserVotesReceivedResult): UserVotesReceivedResult => {
  const known = new Set(current.events.map(eventKey))
  return {
    direction: 'received',
    events: [...current.events, ...next.events.filter((event) => !known.has(eventKey(event)))],
    users: { ...current.users, ...next.users },
    subjects: {
      posts: { ...current.subjects.posts, ...next.subjects.posts },
      comments: { ...current.subjects.comments, ...next.subjects.comments },
    },
    hasMore: next.hasMore,
    nextCursor: next.nextCursor,
  }
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof APIError && error.code === 'filter-timeout'
    ? 'Запрос оказался слишком тяжёлым — сузьте период.'
    : fallback

export function useReceivedVotes({ type, sign, period }: ReceivedVotesFilters) {
  const api = useAPI()
  const { userInfo } = useAppState()
  const sessionUserId = userInfo?.id

  const [feed, setFeed] = useState<UserVotesReceivedResult>()
  const [periodWindow, setPeriodWindow] = useState<{ since?: Date; now: Date }>(() => ({ now: new Date() }))
  // True until the first pages of the current filters are in (automatic follow-up included).
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const queryRef = useRef<ReceivedVotesQuery>({ perpage: PAGE_SIZE })
  const moreAbortRef = useRef<AbortController>()

  useEffect(() => {
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    const now = new Date()
    const since = getPeriodSince(period, now)
    const query: ReceivedVotesQuery = {
      type: type === 'all' ? undefined : type,
      sign: sign === 'minus' ? 'minus' : undefined,
      since,
      perpage: PAGE_SIZE,
    }
    const follow = period !== 'year' && period !== 'all'
    queryRef.current = query
    setPeriodWindow({ since, now })
    setFeed(undefined)
    setLoading(true)
    setLoadingMore(false)
    setError(undefined)

    const load = async () => {
      let result = await api.userAPI.receivedVotes(query, abortController.signal)
      for (let pages = 1; follow && result.hasMore && result.nextCursor && pages < AUTO_FOLLOW_PAGES; pages++) {
        if (abortController.signal.aborted) {
          return
        }
        setFeed(result)
        const next = await api.userAPI.receivedVotes({ ...query, cursor: result.nextCursor }, abortController.signal)
        result = mergePages(result, next)
      }
      if (!abortController.signal.aborted) {
        setFeed(result)
        setLoading(false)
      }
    }

    load().catch((err) => {
      if (abortController.signal.aborted) {
        return
      }
      setError(errorText(err, 'Не удалось загрузить оценки'))
      setLoading(false)
    })

    return () => {
      abortController.abort()
      moreAbortRef.current?.abort()
    }
  }, [api.userAPI, sessionUserId, type, sign, period, attempt])

  const loadMore = useCallback(() => {
    if (!feed?.nextCursor || loadingMore) {
      return
    }
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    moreAbortRef.current = abortController
    setLoadingMore(true)
    setError(undefined)
    api.userAPI
      .receivedVotes({ ...queryRef.current, cursor: feed.nextCursor }, abortController.signal)
      .then((next) => {
        if (abortController.signal.aborted) {
          return
        }
        setFeed((current) => (current ? mergePages(current, next) : next))
        setLoadingMore(false)
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          return
        }
        setError(errorText(err, 'Не удалось загрузить ещё оценки'))
        setLoadingMore(false)
      })
  }, [api.userAPI, feed, loadingMore])

  // Whatever failed is retried: the next page after a partial load, the first page otherwise.
  const retry = useCallback(() => {
    if (feed?.nextCursor) {
      loadMore()
    } else {
      setAttempt((current) => current + 1)
    }
  }, [feed, loadMore])

  return { feed, periodWindow, loading, loadingMore, error, loadMore, retry }
}
