import React from 'react'

import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { UserVoteFeedEvent, UserVotesReceivedResult } from '../API/UserAPI'
import { UserInfo } from '../Types/UserInfo'
import ReceivedVotesDigest from './ReceivedVotesDigest'

/* eslint-disable react/forbid-elements -- the UI kit button is mocked with a raw button */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mockReceivedVotes = jest.fn()
const mockAPI = { userAPI: { receivedVotes: mockReceivedVotes } }
const mockAppState = { userInfo: { id: 99, username: 'me' } }
let mockSearchParams = new URLSearchParams({ tab: 'received' })
const mockSetSearchParams = jest.fn()

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
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}))

jest.mock(
  '@ui/Button',
  () => ({
    __esModule: true,
    default: ({
      children,
      variant: _variant,
      size: _size,
      active: _active,
      ...props
    }: React.ComponentProps<'button'> & { variant?: string; size?: string; active?: boolean }) => (
      <button {...props}>{children}</button>
    ),
  }),
  { virtual: true },
)

jest.mock('./PostLink', () => ({
  __esModule: true,
  default: ({
    children,
    post,
    commentId,
    className,
    onClick,
  }: {
    children?: React.ReactNode
    post: { id: number }
    commentId?: number
    className?: string
    onClick?: React.MouseEventHandler
  }) => (
    <a className={className} href={`/p${post.id}${commentId ? `#${commentId}` : ''}`} onClick={onClick}>
      {children}
    </a>
  ),
}))

jest.mock('./InternalLinkExpandComponent', () => ({
  __esModule: true,
  default: ({ postId, commentId }: { postId: number; commentId?: number }) => (
    <div data-expanded={`${postId}:${commentId ?? ''}`} />
  ),
}))

const user = (id: number): UserInfo => ({ id, username: `user-${id}`, name: `User ${id}`, gender: 0, karma: 0 })

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour)

const vote = (
  type: UserVoteFeedEvent['type'],
  entityId: number,
  voterId: number,
  value: number,
  votedAt: Date,
  postId?: number,
): UserVoteFeedEvent => ({
  type,
  entityId,
  postId: type === 'post' ? entityId : postId,
  voterId,
  targetUserId: 99,
  vote: value,
  votedAt,
})

const page = (
  events: UserVoteFeedEvent[],
  overrides: Partial<UserVotesReceivedResult> = {},
): UserVotesReceivedResult => ({
  direction: 'received',
  events,
  users: Object.fromEntries(events.map((event) => [event.voterId, user(event.voterId)])),
  subjects: {
    posts: { 50: { id: 50, site: 'main', label: 'Селфи-тайм 2', rating: 10 } },
    comments: {
      501: {
        id: 501,
        postId: 50,
        site: 'main',
        postTitle: 'Селфи-тайм 2',
        excerpt: 'Уйдите в другие посты',
        rating: 5,
      },
      502: { id: 502, postId: 50, site: 'main', postTitle: 'Селфи-тайм 2', excerpt: 'С этого момента', rating: 1 },
      601: { id: 601, postId: 60, site: 'dev', postTitle: 'Про миграции', excerpt: 'Кэшем', rating: -1 },
      701: { id: 701, postId: 70, site: 'main', postTitle: 'Мелкий пост', excerpt: 'Ок', rating: 1 },
    },
  },
  hasMore: false,
  nextCursor: undefined,
  ...overrides,
})

const twoWeeks = [
  vote('comment', 501, 1, 1, at(16, 10), 50),
  vote('comment', 501, 2, 1, at(15, 10), 50),
  vote('post', 50, 3, 1, at(15, 9)),
  vote('comment', 502, 1, 1, at(14, 18), 50),
  vote('comment', 601, 4, -1, at(14, 12), 60),
  vote('user', 99, 5, 2, at(14, 11)),
  vote('comment', 701, 6, 1, at(13, 20), 70),
]

describe('ReceivedVotesDigest', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async () => {
    await act(async () => {
      root.render(<ReceivedVotesDigest />)
    })
    await act(async () => {
      await Promise.resolve()
    })
  }

  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim().startsWith(text))

  const click = async (element: Element | undefined) => {
    expect(element).toBeDefined()
    await act(async () => {
      element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await Promise.resolve()
    })
  }

  const openMenus = () => Array.from(container.querySelectorAll('[role="menu"]'))

  beforeEach(() => {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(2026, 8, 16, 15, 0))
    mockReceivedVotes.mockReset()
    mockSetSearchParams.mockReset()
    mockSearchParams = new URLSearchParams({ tab: 'received' })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  test('loads the last two weeks in large pages and renders discussion cards, karma and a tail', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))

    await render()

    expect(mockReceivedVotes).toHaveBeenCalledWith(
      { since: new Date(2026, 8, 3), perpage: 200 },
      expect.any(AbortSignal),
    )
    const text = container.textContent || ''
    expect(buttonByText('Все оценки')).toBeDefined()
    expect(buttonByText('За 2 недели')).toBeDefined()
    expect(text).toContain('14–16 сентября')
    expect(text).toContain('Селфи-тайм 2')
    expect(text).toContain('«Уйдите в другие посты»')
    expect(text).toContain('Про миграции')
    expect(text).toContain('−1')
    expect(text).toContain('Карма профиля')
    expect(text).toContain('7–13 сентября')
    expect(text).toContain('Мелкий пост')
  })

  test('expands a subject inline from its arrow or keyboard and leaves ctrl-click to the link', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()
    const arrows = () => Array.from(container.querySelectorAll<HTMLElement>('[aria-label="Развернуть"]'))

    await act(async () => {
      arrows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-expanded="50:501"]')).not.toBeNull()

    // The expanded arrow is now «Свернуть», so the first «Развернуть» is the post row.
    await act(async () => {
      arrows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(container.querySelector('[data-expanded="50:"]')).not.toBeNull()

    await act(async () => {
      container.querySelector('[aria-label="Свернуть"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('[data-expanded="50:501"]')).toBeNull()
    expect(container.querySelector('[data-expanded="50:"]')).not.toBeNull()

    const quote = Array.from(container.querySelectorAll('a')).find((link) => link.textContent === '«С этого момента»')
    const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    await act(async () => {
      quote?.dispatchEvent(ctrlClick)
    })
    expect(ctrlClick.defaultPrevented).toBe(false)
    expect(container.querySelector('[data-expanded="50:502"]')).toBeNull()
  })

  test('follows the cursor until a bounded window is fully loaded', async () => {
    mockReceivedVotes
      .mockResolvedValueOnce(page(twoWeeks.slice(0, 4), { hasMore: true, nextCursor: 'c2' }))
      .mockResolvedValueOnce(page(twoWeeks.slice(4)))

    await render()
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockReceivedVotes).toHaveBeenCalledTimes(2)
    expect(mockReceivedVotes.mock.calls[1][0]).toEqual({ since: new Date(2026, 8, 3), cursor: 'c2', perpage: 200 })
    expect(container.textContent).toContain('Селфи-тайм 2')
    expect(container.textContent).toContain('Про миграции')
  })

  test('keeps a single filter menu open at a time and closes it on Escape or an outside click', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()

    await click(buttonByText('Все оценки'))
    expect(openMenus()).toHaveLength(1)
    expect(openMenus()[0].textContent).toContain('Только минусы')
    expect(buttonByText('Все оценки')?.getAttribute('aria-expanded')).toBe('true')

    await click(buttonByText('За 2 недели'))
    expect(openMenus()).toHaveLength(1)
    expect(openMenus()[0].textContent).toContain('За год')
    expect(openMenus()[0].textContent).not.toContain('Только минусы')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(openMenus()).toHaveLength(0)

    await click(buttonByText('Все оценки'))
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(openMenus()).toHaveLength(0)
  })

  test('writes the chosen filter to the URL and closes the menu', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()

    await click(buttonByText('Все оценки'))
    await click(buttonByText('Только минусы'))

    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'received', sign: 'minus' })
    expect(openMenus()).toHaveLength(0)
  })

  test('reads filters from the URL and names the buttons after the choice', async () => {
    mockSearchParams = new URLSearchParams({ tab: 'received', what: 'comment', sign: 'minus', period: 'year' })
    mockReceivedVotes.mockResolvedValueOnce(page([]))

    await render()

    expect(mockReceivedVotes).toHaveBeenCalledWith(
      { type: 'comment', sign: 'minus', since: new Date(2025, 8, 17), perpage: 200 },
      expect.any(AbortSignal),
    )
    expect(buttonByText('Минусы за комментарии')).toBeDefined()
    expect(buttonByText('За год')).toBeDefined()
    // With a filter applied the period was not empty, only the filtered slice was.
    expect(container.textContent).toContain('За год таких оценок не было.')
  })

  test('offers a wider period when the window has no votes', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page([]))
    await render()

    expect(container.textContent).toContain('За 2 недели оценок не было.')
    await click(buttonByText('Показать за месяц'))

    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'received', period: 'month' })
  })

  test('loads more of an unbounded period on demand instead of following the cursor', async () => {
    mockSearchParams = new URLSearchParams({ tab: 'received', period: 'all' })
    mockReceivedVotes
      .mockResolvedValueOnce(page(twoWeeks.slice(0, 4), { hasMore: true, nextCursor: 'c2' }))
      .mockResolvedValueOnce(page(twoWeeks.slice(4)))

    await render()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockReceivedVotes).toHaveBeenCalledTimes(1)

    await click(buttonByText('Показать ещё'))

    expect(mockReceivedVotes).toHaveBeenCalledTimes(2)
    expect(mockReceivedVotes.mock.calls[1][0]).toEqual({ cursor: 'c2', perpage: 200 })
    expect(container.textContent).toContain('Про миграции')
  })
})
