import React from 'react'

import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { UserVoteFeedEvent, UserVotesResult } from '../API/UserAPI'
import { PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import UserProfileVotes from './UserProfileVotes'

/* eslint-disable react/forbid-elements -- raw buttons keep these component tests independent from the UI kit */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mockUserVotes = jest.fn()
const mockAPI = { userAPI: { userVotes: mockUserVotes } }
const mockAppState = { userInfo: { id: 1, username: 'me' } }
let mockFilter = ''
let mockTab = 'mine'

jest.mock('../AppState/AppState', () => ({
  useAPI: () => mockAPI,
  useAppState: () => mockAppState,
}))

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<'a'> & { to: string }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
  useSearchParams: () => [new URLSearchParams({ tab: mockTab })],
}))

jest.mock(
  '@ui/Button',
  () => ({
    __esModule: true,
    default: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  }),
  { virtual: true },
)

jest.mock('./useProfileFeedFilter', () => ({
  useProfileFeedFilter: () => ({
    filter: mockFilter,
    defaultFilter: mockFilter,
    filterInputRef: { current: null },
    handleFilterChange: jest.fn(),
  }),
}))

jest.mock('./PostComponent', () => ({
  __esModule: true,
  default: ({
    post,
    onChange,
  }: {
    post: PostInfo
    onChange?: (id: number, post: Partial<PostInfo>, done: boolean) => void
  }) => (
    <div data-post-id={post.id}>
      <button onClick={() => onChange?.(post.id, { rating: post.rating - (post.vote || 0), vote: 0 }, true)}>
        Снять оценку {post.id}
      </button>
    </div>
  ),
}))

jest.mock('./CommentComponent', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('./ContentComponent', () => ({
  LARGE_AUTO_CUT: 1000,
}))

jest.mock('./RatingSwitch', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('./PostLink', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

jest.mock('./Username', () => ({
  __esModule: true,
  default: ({ user }: { user: UserInfo }) => <span>{user.username}</span>,
}))

jest.mock('./DateComponent', () => ({
  formatRelativeAgeBucket: () => 'недавно',
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const user = (id: number): UserInfo => ({
  id,
  username: `user-${id}`,
  name: `User ${id}`,
  gender: 0,
  karma: 0,
})

const post = (id: number, targetUserId = 10): PostInfo => ({
  id,
  site: 'main',
  author: user(targetUserId),
  created: new Date(Date.UTC(2026, 4, 10)),
  content: `post ${id}`,
  rating: 1,
  comments: 0,
  newComments: 0,
  vote: 1,
})

const voteEvent = (
  type: UserVoteFeedEvent['type'],
  entityId: number,
  options: Partial<Omit<UserVoteFeedEvent, 'type' | 'entityId'>> = {},
): UserVoteFeedEvent => ({
  type,
  entityId,
  postId: options.postId,
  vote: options.vote ?? 1,
  votedAt: options.votedAt ?? new Date(Date.UTC(2026, 4, 11, 10, 30 - entityId)),
  voterId: options.voterId ?? 1,
  targetUserId: options.targetUserId ?? 10,
})

const postEvent = (id: number, targetUserId = 10): UserVoteFeedEvent =>
  voteEvent('post', id, { postId: id, targetUserId })

const mineVoteResult = (events: UserVoteFeedEvent[], hasMore = false, nextCursor?: string): UserVotesResult => {
  const posts = events.reduce<Record<number, PostInfo>>((result, event) => {
    if (event.type === 'post') {
      result[event.entityId] = post(event.entityId, event.targetUserId)
    }
    return result
  }, {})

  return {
    direction: 'mine',
    events,
    users: {
      1: user(1),
      10: user(10),
      20: user(20),
    },
    entities: {
      posts,
      comments: {},
      parentComments: {},
      postTitles: {},
    },
    hasMore,
    nextCursor,
  }
}

const receivedVoteResult = (events: UserVoteFeedEvent[], hasMore = false, nextCursor?: string): UserVotesResult => {
  const posts = events.reduce<Record<number, { id: number; site: string; label: string; rating: number }>>(
    (result, event) => {
      if (event.type === 'post') {
        result[event.entityId] = {
          id: event.entityId,
          site: 'main',
          label: `received post ${event.entityId}`,
          rating: 5,
        }
      }
      return result
    },
    {},
  )
  const comments = events.reduce<
    Record<number, { id: number; postId: number; site: string; postTitle?: string; rating: number }>
  >((result, event) => {
    if (event.type === 'comment') {
      result[event.entityId] = {
        id: event.entityId,
        postId: event.postId || 0,
        site: 'main',
        postTitle: `parent post ${event.postId}`,
        rating: 3,
      }
    }
    return result
  }, {})

  return {
    direction: 'received',
    events,
    users: {
      1: user(1),
      10: user(10),
      20: user(20),
      30: user(30),
    },
    subjects: { posts, comments },
    hasMore,
    nextCursor,
  }
}

describe('UserProfileVotes request state', () => {
  let container: HTMLDivElement
  let root: Root

  const renderVotes = async () => {
    await act(async () => {
      root.render(<UserProfileVotes />)
      await Promise.resolve()
    })
  }

  const settlePromises = async () => {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  const clickButton = (label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    )
    if (!button) {
      throw new Error(`Button not found: ${label}`)
    }
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  const renderedPostIds = () =>
    Array.from(container.querySelectorAll('[data-post-id]')).map((element) =>
      Number(element.getAttribute('data-post-id')),
    )
  const requestSignal = (callIndex: number) => mockUserVotes.mock.calls[callIndex][4] as AbortSignal

  beforeEach(() => {
    mockFilter = ''
    mockTab = 'mine'
    mockAppState.userInfo.id = 1
    mockUserVotes.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  test('ignores a stale load-more result after the tab changes', async () => {
    const stalePage = deferred<UserVotesResult>()
    mockUserVotes
      .mockResolvedValueOnce(mineVoteResult([postEvent(1)], true, 'old-cursor'))
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce(receivedVoteResult([postEvent(10, 20)]))

    await renderVotes()
    clickButton('Показать ещё')
    const staleLoadMoreSignal = requestSignal(1)
    expect(staleLoadMoreSignal.aborted).toBe(false)

    mockTab = 'received'
    await renderVotes()
    expect(staleLoadMoreSignal.aborted).toBe(true)

    await act(async () => {
      stalePage.resolve(mineVoteResult([postEvent(2)], true, 'stale-cursor'))
      await stalePage.promise
    })

    expect(container.textContent).toContain('пост #10')
    expect(container.textContent).not.toContain('пост #2')
    expect(container.textContent).not.toContain('Показать ещё')
  })

  test('ignores a stale load-more rejection and resets loading state for the new query', async () => {
    const stalePage = deferred<UserVotesResult>()
    mockUserVotes
      .mockResolvedValueOnce(mineVoteResult([postEvent(1)], true, 'old-cursor'))
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce(mineVoteResult([postEvent(10, 20)], true, 'new-cursor'))

    await renderVotes()
    clickButton('Показать ещё')
    const staleLoadMoreSignal = requestSignal(1)

    mockFilter = 'new-filter'
    await renderVotes()
    expect(staleLoadMoreSignal.aborted).toBe(true)

    const newLoadMoreButton = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Показать ещё',
    )
    expect(newLoadMoreButton).toBeDefined()
    expect(newLoadMoreButton?.disabled).toBe(false)

    await act(async () => {
      stalePage.reject(new Error('old request failed'))
      await stalePage.promise.catch(() => undefined)
    })

    expect(renderedPostIds()).toEqual([10])
    expect(container.textContent).not.toContain('Не удалось загрузить ещё оценки')
  })

  test('renders compact normalized received subjects without mounting full post entities', async () => {
    mockTab = 'received'
    mockUserVotes.mockResolvedValueOnce(
      receivedVoteResult([
        voteEvent('post', 40, { postId: 40 }),
        voteEvent('comment', 50, { postId: 77 }),
        voteEvent('user', 30),
      ]),
    )

    await renderVotes()

    expect(container.textContent).toContain('пост #40: received post 40')
    expect(container.textContent).toContain('комментарий #50 в посте #77: parent post 77')
    expect(container.textContent).toContain('профиль user-30')
    expect(renderedPostIds()).toEqual([])
  })

  test('deduplicates appended refs and joins a group across the page boundary', async () => {
    mockUserVotes
      .mockResolvedValueOnce(mineVoteResult([postEvent(1)], true, 'next-cursor'))
      .mockResolvedValueOnce(mineVoteResult([postEvent(1), postEvent(2)]))

    await renderVotes()
    clickButton('Показать ещё')
    await settlePromises()

    expect(renderedPostIds()).toEqual([1, 2])
    expect(container.textContent).toContain('2 оценки')
  })

  test('aborts an in-flight initial request when the query key changes', async () => {
    const staleInitialPage = deferred<UserVotesResult>()
    mockUserVotes.mockReturnValueOnce(staleInitialPage.promise).mockResolvedValueOnce(mineVoteResult([postEvent(10)]))

    await renderVotes()
    const staleInitialSignal = requestSignal(0)
    expect(staleInitialSignal.aborted).toBe(false)

    mockFilter = 'new-filter'
    await renderVotes()

    expect(staleInitialSignal.aborted).toBe(true)
    expect(renderedPostIds()).toEqual([10])
  })

  test('aborts an in-flight request when the session user changes', async () => {
    const staleInitialPage = deferred<UserVotesResult>()
    mockUserVotes.mockReturnValueOnce(staleInitialPage.promise).mockResolvedValueOnce(mineVoteResult([postEvent(10)]))

    await renderVotes()
    const staleInitialSignal = requestSignal(0)

    mockAppState.userInfo.id = 2
    await renderVotes()

    expect(staleInitialSignal.aborted).toBe(true)
    expect(renderedPostIds()).toEqual([10])
  })

  test('keeps loaded events and offers a retry when load-more fails', async () => {
    mockUserVotes
      .mockResolvedValueOnce(mineVoteResult([postEvent(1)], true, 'next-cursor'))
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(mineVoteResult([postEvent(2)]))

    await renderVotes()
    clickButton('Показать ещё')
    await settlePromises()

    expect(renderedPostIds()).toEqual([1])
    expect(container.textContent).toContain('Не удалось загрузить ещё оценки')
    expect(container.textContent).toContain('Повторить')

    clickButton('Повторить')
    await settlePromises()

    expect(renderedPostIds()).toEqual([1, 2])
    expect(container.textContent).not.toContain('Не удалось загрузить ещё оценки')
  })

  test('removes a confirmed zero vote and recalculates its group', async () => {
    mockUserVotes.mockResolvedValueOnce(mineVoteResult([postEvent(1), postEvent(2)]))

    await renderVotes()
    expect(container.textContent).toContain('2 оценки')

    clickButton('Снять оценку 1')

    expect(renderedPostIds()).toEqual([2])
    expect(container.textContent).not.toContain('2 оценки')
  })
})
