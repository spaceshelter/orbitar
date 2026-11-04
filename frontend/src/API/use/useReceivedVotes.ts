import { useCallback, useMemo } from 'react'

import { useAPI } from '../../AppState/AppState'
import { getPeriodSince, VotePeriod, VoteSign } from '../../Utils/receivedVotesDigest'
import { ReceivedVoteType, UserVotesReceivedResult } from '../UserAPI'
import { appendVoteFeedPage, useVoteFeedPages } from './useVoteFeedPages'

const PAGE_SIZE = 200
// Periods up to a month follow the cursor on their own for this many pages; past
// that, and for a year or all time, pages load on demand and the oldest loaded
// section may be incomplete (the digest marks it).
const AUTO_FOLLOW_PAGES = 5

export type ReceivedVotesFilters = { type: 'all' | ReceivedVoteType; sign: VoteSign; period: VotePeriod }

const mergeReceivedPages = (
  current: UserVotesReceivedResult,
  next: UserVotesReceivedResult,
): UserVotesReceivedResult => ({
  ...appendVoteFeedPage(current, next),
  subjects: {
    posts: { ...current.subjects.posts, ...next.subjects.posts },
    comments: { ...current.subjects.comments, ...next.subjects.comments },
  },
})

export function useReceivedVotes({ type, sign, period }: ReceivedVotesFilters) {
  const api = useAPI()

  // The window ends when the filters are chosen; later pages and the section labels share it.
  const query = useMemo(() => {
    const now = new Date()
    return {
      now,
      since: getPeriodSince(period, now),
      type: type === 'all' ? undefined : type,
      sign: sign === 'minus' ? ('minus' as const) : undefined,
    }
  }, [type, sign, period])

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) =>
      api.userAPI.receivedVotes(
        { type: query.type, sign: query.sign, since: query.since, cursor, perpage: PAGE_SIZE },
        signal,
      ),
    [api.userAPI, query],
  )

  const { feed, loading, loadingMore, error, loadMoreError, loadMore, retry } = useVoteFeedPages(fetchPage, {
    merge: mergeReceivedPages,
    timeoutError: 'Запрос оказался слишком тяжёлым — сузьте период.',
    followPages: period === 'year' || period === 'all' ? 1 : AUTO_FOLLOW_PAGES,
  })

  return { feed, periodWindow: query, loading, loadingMore, error: error || loadMoreError, loadMore, retry }
}
