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
const mockAppState = { userInfo: { username: 'me' } }
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

const postEvent = (id: number, targetUserId = 10): UserVoteFeedEvent => ({
  type: 'post',
  vote: 1,
  votedAt: new Date(Date.UTC(2026, 4, 11, 10, 30 - id)),
  voterId: 1,
  targetUserId,
  post: {
    id,
    site: 'main',
    author: user(targetUserId),
    created: new Date(Date.UTC(2026, 4, 10)),
    content: `post ${id}`,
    rating: 1,
    comments: 0,
    newComments: 0,
    vote: 1,
  },
})

const voteResult = (events: UserVoteFeedEvent[], hasMore = false, nextCursor?: string): UserVotesResult => ({
  events,
  users: {
    10: user(10),
    20: user(20),
  },
  hasMore,
  nextCursor,
})

describe('UserProfileVotes request state', () => {
  let container: HTMLDivElement
  let root: Root

  const renderVotes = async () => {
    await act(async () => {
      root.render(<UserProfileVotes basePath='/profile/karma' showTabs={false} />)
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

  beforeEach(() => {
    mockFilter = ''
    mockTab = 'mine'
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
      .mockResolvedValueOnce(voteResult([postEvent(1)], true, 'old-cursor'))
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce(voteResult([postEvent(10, 20)]))

    await renderVotes()
    clickButton('Показать ещё')

    mockTab = 'received'
    await renderVotes()

    await act(async () => {
      stalePage.resolve(voteResult([postEvent(2)], true, 'stale-cursor'))
      await stalePage.promise
    })

    expect(container.textContent).toContain('пост #10')
    expect(container.textContent).not.toContain('пост #2')
    expect(container.textContent).not.toContain('Показать ещё')
  })

  test('ignores a stale load-more rejection and resets loading state for the new query', async () => {
    const stalePage = deferred<UserVotesResult>()
    mockUserVotes
      .mockResolvedValueOnce(voteResult([postEvent(1)], true, 'old-cursor'))
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce(voteResult([postEvent(10, 20)], true, 'new-cursor'))

    await renderVotes()
    clickButton('Показать ещё')

    mockFilter = 'new-filter'
    await renderVotes()

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

  test('keeps loaded events and offers a retry when load-more fails', async () => {
    mockUserVotes
      .mockResolvedValueOnce(voteResult([postEvent(1)], true, 'next-cursor'))
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(voteResult([postEvent(2)]))

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
    mockUserVotes.mockResolvedValueOnce(voteResult([postEvent(1), postEvent(2)]))

    await renderVotes()
    expect(container.textContent).toContain('2 оценки')

    clickButton('Снять оценку 1')

    expect(renderedPostIds()).toEqual([2])
    expect(container.textContent).not.toContain('2 оценки')
  })
})
