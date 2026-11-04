import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppState } from '../../AppState/AppState'
import { UserInfo } from '../../Types/UserInfo'
import { APIError } from '../APIBase'
import { getVoteEventKey, UserVoteFeedEvent } from '../UserAPI'

type VoteFeedPage = {
  events: UserVoteFeedEvent[]
  users: Record<number, UserInfo>
  hasMore: boolean
  nextCursor?: string
}

// Appends the next page: events already loaded are skipped (votes can shift between
// two requests), users are merged and the cursor moves on. Each feed merges its own
// lookup tables on top.
export const appendVoteFeedPage = <F extends VoteFeedPage>(current: F, next: F): F => {
  const known = new Set(current.events.map(getVoteEventKey))
  return {
    ...next,
    events: [...current.events, ...next.events.filter((event) => !known.has(getVoteEventKey(event)))],
    users: { ...current.users, ...next.users },
  }
}

const errorText = (error: unknown, timeoutError: string, fallback: string) =>
  error instanceof APIError && error.code === 'filter-timeout' ? timeoutError : fallback

type VoteFeedOptions<F> = {
  // A stable function, such as one declared at module level.
  merge: (current: F, next: F) => F
  // Shown when the server stops a query that runs past its time budget.
  timeoutError: string
  // How many pages the first load follows on its own.
  followPages?: number
  // Keep the loaded pages on screen until the first page of a new query arrives.
  keepWhileReloading?: boolean
}

// Pages of a vote feed. The first page loads again whenever `fetchPage` changes or
// another user signs in, later pages load on demand. A superseded request is aborted
// and its result ignored.
export function useVoteFeedPages<F extends VoteFeedPage>(
  fetchPage: (cursor: string | undefined, signal: AbortSignal) => Promise<F>,
  { merge, timeoutError, followPages = 1, keepWhileReloading = false }: VoteFeedOptions<F>,
) {
  const { userInfo } = useAppState()
  const sessionUserId = userInfo?.id
  const [feed, setFeed] = useState<F>()
  // True until the first pages of the current query are in (followed pages included).
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [loadMoreError, setLoadMoreError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const moreAbortRef = useRef<AbortController>()
  const sessionUserRef = useRef<number>()

  useEffect(() => {
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    // Another user's feed is never kept on screen.
    if (!keepWhileReloading || sessionUserRef.current !== sessionUserId) {
      setFeed(undefined)
    }
    sessionUserRef.current = sessionUserId
    setLoading(true)
    setLoadingMore(false)
    setError(undefined)
    setLoadMoreError(undefined)

    const load = async () => {
      let result = await fetchPage(undefined, abortController.signal)
      for (let pages = 1; result.hasMore && result.nextCursor && pages < followPages; pages++) {
        if (abortController.signal.aborted) {
          return
        }
        setFeed(result)
        result = merge(result, await fetchPage(result.nextCursor, abortController.signal))
      }
      if (!abortController.signal.aborted) {
        setFeed(result)
        setLoading(false)
      }
    }

    load().catch((err) => {
      if (!abortController.signal.aborted) {
        setError(errorText(err, timeoutError, 'Не удалось загрузить оценки'))
        setLoading(false)
      }
    })

    return () => {
      abortController.abort()
      moreAbortRef.current?.abort()
    }
  }, [fetchPage, merge, timeoutError, followPages, keepWhileReloading, sessionUserId, attempt])

  const loadMore = useCallback(() => {
    const cursor = feed?.nextCursor
    if (!cursor || loadingMore) {
      return
    }
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    moreAbortRef.current = abortController
    setLoadingMore(true)
    setLoadMoreError(undefined)
    fetchPage(cursor, abortController.signal)
      .then((next) => {
        if (!abortController.signal.aborted) {
          setFeed((current) => (current ? merge(current, next) : next))
          setLoadingMore(false)
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          setLoadMoreError(errorText(err, timeoutError, 'Не удалось загрузить ещё оценки'))
          setLoadingMore(false)
        }
      })
  }, [feed, loadingMore, fetchPage, merge, timeoutError])

  // Repeats what failed: the next page, or the first one.
  const retry = useCallback(() => {
    if (loadMoreError) {
      loadMore()
    } else {
      setAttempt((current) => current + 1)
    }
  }, [loadMoreError, loadMore])

  return { feed, setFeed, loading, loadingMore, error, loadMoreError, loadMore, retry }
}
