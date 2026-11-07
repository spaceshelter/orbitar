import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppState } from '../../AppState/AppState'
import { APIError } from '../APIBase'
import { getVoteEventKey, UserVotesResultBase } from '../UserAPI'

type Tables = Record<string, Record<number, unknown>>

// Votes can shift between two requests, so events already loaded are skipped.
const appendPage = <F extends UserVotesResultBase>(current: F, next: F, tables: keyof F): F => {
  const known = new Set(current.events.map(getVoteEventKey))
  const [loaded, added] = [current[tables], next[tables]] as unknown[] as Tables[]
  return {
    ...next,
    events: [...current.events, ...next.events.filter((event) => !known.has(getVoteEventKey(event)))],
    users: { ...current.users, ...next.users },
    [tables]: Object.keys(added).reduce(
      (merged, name) => ({ ...merged, [name]: { ...loaded[name], ...added[name] } }),
      loaded,
    ),
  }
}

const errorText = (error: unknown, timeoutError: string, fallback: string) =>
  error instanceof APIError && error.code === 'filter-timeout' ? timeoutError : fallback

type VoteFeedOptions<F> = {
  // The field of a page with the feed's own lookup tables.
  tables: keyof F
  timeoutError: string
  // How many pages the first load follows on its own.
  followPages?: number
  keepWhileReloading?: boolean
}

// Reloads from the first page whenever `fetchPage` changes or another user signs in.
export function useVoteFeedPages<F extends UserVotesResultBase>(
  fetchPage: (cursor: string | undefined, signal: AbortSignal) => Promise<F>,
  { tables, timeoutError, followPages = 1, keepWhileReloading = false }: VoteFeedOptions<F>,
) {
  const sessionUserId = useAppState().userInfo?.id
  const [feed, setFeed] = useState<F>()
  // True until the first pages of the current query are in (followed pages included).
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [loadMoreError, setLoadMoreError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const moreAbortRef = useRef<AbortController>()
  const feedUserRef = useRef<number>()

  useEffect(() => {
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    // Another user's feed is never kept on screen.
    if (!keepWhileReloading || feedUserRef.current !== sessionUserId) setFeed(undefined)
    feedUserRef.current = sessionUserId
    setLoading(true)
    setLoadingMore(false)
    setError(undefined)
    setLoadMoreError(undefined)

    const load = async () => {
      let result = await fetchPage(undefined, abortController.signal)
      for (let pages = 1; pages < followPages && result.nextCursor && !abortController.signal.aborted; pages++) {
        setFeed(result)
        result = appendPage(result, await fetchPage(result.nextCursor, abortController.signal), tables)
      }
      if (abortController.signal.aborted) return
      setFeed(result)
      setLoading(false)
    }
    load().catch((err) => {
      if (abortController.signal.aborted) return
      setError(errorText(err, timeoutError, 'Не удалось загрузить оценки'))
      setLoading(false)
    })

    return () => {
      abortController.abort()
      moreAbortRef.current?.abort()
    }
  }, [fetchPage, tables, timeoutError, followPages, keepWhileReloading, sessionUserId, attempt])

  const loadMore = useCallback(() => {
    const cursor = feed?.nextCursor
    if (!cursor || loadingMore) return
    const abortController = new AbortController()
    moreAbortRef.current?.abort()
    moreAbortRef.current = abortController
    setLoadingMore(true)
    setLoadMoreError(undefined)
    fetchPage(cursor, abortController.signal)
      .then((next) => {
        if (abortController.signal.aborted) return
        setFeed((current) => (current ? appendPage(current, next, tables) : next))
        setLoadingMore(false)
      })
      .catch((err) => {
        if (abortController.signal.aborted) return
        setLoadMoreError(errorText(err, timeoutError, 'Не удалось загрузить ещё оценки'))
        setLoadingMore(false)
      })
  }, [feed, loadingMore, fetchPage, tables, timeoutError])

  const retry = useCallback(
    () => (loadMoreError ? loadMore() : setAttempt((current) => current + 1)),
    [loadMoreError, loadMore],
  )

  return { feed, setFeed, loading, loadingMore, error, loadMoreError, loadMore, retry }
}
