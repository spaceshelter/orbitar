import React from 'react'

import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { ReceivedCommentSubject, ReceivedMediaKind, UserVoteFeedEvent, UserVotesReceivedResult } from '../API/UserAPI'
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

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

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

const comment = (
  id: number,
  postId: number,
  postTitle: string,
  excerpt: string,
  media?: ReceivedMediaKind,
): ReceivedCommentSubject => ({
  id,
  postId,
  site: 'main',
  postTitle,
  excerpt,
  media,
  created: new Date(2026, 8, 12, 18, 6),
  rating: 1,
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
      501: comment(501, 50, 'Селфи-тайм 2', 'Уйдите в другие посты'),
      502: comment(502, 50, 'Селфи-тайм 2', 'С этого момента'),
      503: comment(503, 50, 'Селфи-тайм 2', 'Третий'),
      504: comment(504, 50, 'Селфи-тайм 2', 'Четвёртый'),
      505: comment(505, 50, 'Селфи-тайм 2', 'Пятый'),
      511: comment(511, 51, 'Мемы', '', 'image'),
      512: comment(512, 51, 'Мемы', '', 'video'),
      513: comment(513, 51, 'Мемы', '', 'gif'),
      514: comment(514, 51, 'Мемы', '', 'media'),
      515: comment(515, 51, 'Мемы', ''),
      901: { ...comment(901, 90, '', 'Ответ'), postTitle: undefined, postMedia: 'image' },
      911: { ...comment(911, 91, '', 'Ответ'), postTitle: undefined, postMedia: 'media' },
      601: { ...comment(601, 60, 'Про миграции', 'Кэшем'), site: 'dev' },
      701: comment(701, 70, 'Мелкий пост', 'Ок'),
      801: comment(801, 80, 'Ещё один небольшой разговор', 'Да'),
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

  const flush = async () => {
    await act(async () => {
      await Promise.resolve()
    })
  }

  const press = async (key: string, target: Element | null = document.activeElement) => {
    expect(target).not.toBeNull()
    await act(async () => {
      target?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
  }

  const focusedText = () => document.activeElement?.textContent?.trim()

  const sections = () => Array.from(container.querySelectorAll('section'))

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
    mockSearchParams = new URLSearchParams({ tab: 'received', what: 'comment', period: 'year' })
    mockReceivedVotes.mockResolvedValueOnce(page([]))

    await render()

    expect(mockReceivedVotes).toHaveBeenCalledWith(
      { type: 'comment', since: new Date(2025, 8, 17), perpage: 200 },
      expect.any(AbortSignal),
    )
    expect(buttonByText('Комментарии')).toBeDefined()
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
  test('shows a placeholder until the first page arrives', async () => {
    const first = deferred<UserVotesReceivedResult>()
    mockReceivedVotes.mockReturnValueOnce(first.promise)

    await render()
    const placeholder = container.querySelector('.skeleton')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true')

    await act(async () => {
      first.resolve(page(twoWeeks))
    })
    await flush()
    expect(container.querySelector('.skeleton')).toBeNull()
    expect(container.textContent).toContain('Селфи-тайм 2')
  })

  test('holds the oldest section back while it is still being loaded', async () => {
    const second = deferred<UserVotesReceivedResult>()
    mockReceivedVotes
      .mockResolvedValueOnce(page(twoWeeks, { hasMore: true, nextCursor: 'c2' }))
      .mockReturnValueOnce(second.promise)

    await render()
    await flush()

    expect(mockReceivedVotes).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('14–16 сентября')
    expect(container.textContent).not.toContain('7–13 сентября')
    expect(container.querySelector('.skeleton')).not.toBeNull()

    await act(async () => {
      second.resolve(page([vote('comment', 801, 7, 1, at(12, 20), 80)]))
    })
    await flush()
    expect(container.textContent).toContain('7–13 сентября')
    expect(container.textContent).toContain('Ещё один небольшой разговор')
    expect(container.textContent).not.toContain('Загружена только часть')
    expect(container.querySelector('.skeleton')).toBeNull()
  })

  test('marks the oldest section as partial when the automatic loading stops before its end', async () => {
    const older = [
      vote('comment', 701, 6, 1, at(13, 20), 70),
      vote('comment', 801, 7, 1, at(12, 20), 80),
      vote('comment', 801, 8, 1, at(11, 20), 80),
      vote('comment', 701, 9, 1, at(10, 20), 70),
      vote('user', 99, 10, 1, at(9, 20)),
    ]
    mockReceivedVotes.mockResolvedValueOnce(
      page([...twoWeeks.slice(0, 6), older[0]], { hasMore: true, nextCursor: 'c2' }),
    )
    older.slice(1).forEach((event, index) => {
      mockReceivedVotes.mockResolvedValueOnce(page([event], { hasMore: true, nextCursor: `c${index + 3}` }))
    })

    await render()
    for (let i = 0; i < 6; i++) {
      await flush()
    }

    expect(mockReceivedVotes).toHaveBeenCalledTimes(5)
    const [current, oldest] = sections()
    expect(current.textContent).toContain('14–16 сентября')
    expect(current.textContent).not.toContain('Загружена только часть')
    expect(oldest.textContent).toContain('7–13 сентября')
    expect(oldest.textContent).toContain('Загружена только часть оценок за эти дни.')
    // Two votes loaded so far in each small discussion; more may follow.
    expect(oldest.textContent).toContain('Пока по 1–2 оценки в 2 обсуждениях')
    expect(buttonByText('Показать ещё')).toBeDefined()
  })

  test('keeps the loaded votes when loading more fails and retries with the same button', async () => {
    mockSearchParams = new URLSearchParams({ tab: 'received', period: 'all' })
    mockReceivedVotes
      .mockResolvedValueOnce(page(twoWeeks.slice(0, 4), { hasMore: true, nextCursor: 'c2' }))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(page(twoWeeks.slice(4)))

    await render()
    await click(buttonByText('Показать ещё'))

    expect(container.textContent).toContain('Селфи-тайм 2')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Не удалось загрузить ещё оценки')
    expect(buttonByText('Показать ещё')).toBeUndefined()

    await click(buttonByText('Повторить'))

    expect(mockReceivedVotes).toHaveBeenCalledTimes(3)
    expect(mockReceivedVotes.mock.calls[2][0]).toEqual({ cursor: 'c2', perpage: 200 })
    expect(container.textContent).toContain('Про миграции')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  test('offers to retry when the first page fails', async () => {
    mockReceivedVotes.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page(twoWeeks))

    await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Не удалось загрузить оценки')

    await click(buttonByText('Повторить'))

    expect(mockReceivedVotes).toHaveBeenCalledTimes(2)
    expect(mockReceivedVotes.mock.calls[1][0]).toEqual({ since: new Date(2026, 8, 3), perpage: 200 })
    expect(container.textContent).toContain('Селфи-тайм 2')
  })

  test('collapses an expanded card with the same toggle', async () => {
    mockReceivedVotes.mockResolvedValueOnce(
      page([
        vote('comment', 501, 1, 1, at(16, 10), 50),
        vote('comment', 502, 2, 1, at(16, 9), 50),
        vote('comment', 503, 3, 1, at(16, 8), 50),
        vote('comment', 504, 4, 1, at(16, 7), 50),
        vote('comment', 505, 5, -1, at(16, 6), 50),
      ]),
    )
    await render()
    const rows = () => container.querySelectorAll('article [aria-label="Развернуть"]').length

    expect(rows()).toBe(3)
    await click(buttonByText('ещё 2 комментария'))
    expect(rows()).toBe(5)

    const collapse = buttonByText('свернуть')
    expect(collapse?.getAttribute('aria-expanded')).toBe('true')
    await click(collapse)
    expect(rows()).toBe(3)
    expect(buttonByText('ещё 2 комментария')?.getAttribute('aria-expanded')).toBe('false')
  })

  test('names comments without text by what they hold and when they were written', async () => {
    mockReceivedVotes.mockResolvedValueOnce(
      page([
        vote('comment', 511, 1, 1, at(16, 10), 51),
        vote('comment', 512, 2, 1, at(16, 9), 51),
        vote('comment', 513, 3, 1, at(16, 8), 51),
        vote('comment', 514, 4, 1, at(16, 7), 51),
        vote('comment', 515, 5, 1, at(16, 6), 51),
      ]),
    )
    await render()
    await click(buttonByText('ещё 2 комментария'))

    const text = container.textContent || ''
    expect(text).toContain('картинка · 12 сен, 18:06')
    expect(text).toContain('видео · 12 сен, 18:06')
    expect(text).toContain('гифка · 12 сен, 18:06')
    // Neither the kind nor the text is known: the row says it is some media.
    expect(text.match(/медиа · 12 сен, 18:06/g)).toHaveLength(2)
    expect(text).not.toContain('комментарий ·')
    expect(text).not.toContain('«»')
  })

  test('names discussions of untitled posts without text by their media, without quotes', async () => {
    mockReceivedVotes.mockResolvedValueOnce(
      page(
        [
          vote('post', 92, 1, 1, at(16, 10)),
          vote('post', 92, 2, 1, at(16, 9)),
          vote('post', 92, 3, 1, at(16, 8)),
          vote('comment', 901, 4, 1, at(15, 10), 90),
          vote('comment', 911, 5, 1, at(15, 9), 91),
        ],
        {
          subjects: {
            posts: { 92: { id: 92, site: 'main', label: '', media: 'video', rating: 3 } },
            comments: page([]).subjects.comments,
          },
        },
      ),
    )
    await render()

    const title = container.querySelector('article header a')
    expect(title?.textContent).toBe('Пост с видео')
    expect(title?.className).toContain('generatedTitle')
    const items = Array.from(container.querySelectorAll('.tailItem')).map((item) => item.textContent)
    expect(items).toEqual(['Пост с картинкой\u00a0+1\u00a0·', 'Пост с медиа\u00a0+1'])
  })

  test('keeps the separators of the small-discussions line inside its items', async () => {
    mockReceivedVotes.mockResolvedValueOnce(
      page([vote('comment', 701, 6, 1, at(13, 20), 70), vote('comment', 801, 7, 1, at(12, 20), 80)]),
    )
    await render()

    const tail = container.querySelector('.tail')
    const items = Array.from(container.querySelectorAll('.tailItem')).map((item) => item.textContent)
    expect(items).toEqual(['«Мелкий пост» +1 ·', '«Ещё один небольшой разговор» +1'])
    const looseText = Array.from(tail?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
    expect(looseText).not.toContain('·')
  })

  test('moves focus into an open menu and through its items from the keyboard', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()
    const trigger = buttonByText('Все оценки')

    await click(trigger)
    expect(focusedText()).toBe('Всё')
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true')

    await press('ArrowDown')
    expect(focusedText()).toBe('Комментарии')
    await press('End')
    expect(focusedText()).toBe('Только минусы')
    await press('ArrowDown')
    expect(focusedText()).toBe('Всё')
    await press('ArrowUp')
    expect(focusedText()).toBe('Только минусы')
    await press('Home')
    expect(focusedText()).toBe('Всё')

    await press('Escape')
    expect(openMenus()).toHaveLength(0)
    expect(document.activeElement).toBe(trigger)

    await press('ArrowDown', trigger || null)
    expect(openMenus()).toHaveLength(1)
    expect(focusedText()).toBe('Всё')
  })

  test('returns focus to the menu button after a choice', async () => {
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()
    const trigger = buttonByText('За 2 недели')

    await click(trigger)
    await click(buttonByText('За месяц'))

    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'received', period: 'month' })
    expect(openMenus()).toHaveLength(0)
    expect(document.activeElement).toBe(trigger)
  })

  test('limits minus-only views to a month', async () => {
    mockSearchParams = new URLSearchParams({ tab: 'received', sign: 'minus', period: 'year' })
    mockReceivedVotes.mockResolvedValueOnce(page([]))

    await render()

    expect(mockReceivedVotes).toHaveBeenCalledWith(
      { sign: 'minus', since: new Date(2026, 7, 18), perpage: 200 },
      expect.any(AbortSignal),
    )
    expect(buttonByText('За месяц')).toBeDefined()
    expect(container.textContent).toContain('За месяц таких оценок не было.')
    expect(buttonByText('Показать за')).toBeUndefined()

    await click(buttonByText('За месяц'))
    const menu = openMenus()[0]
    expect(Array.from(menu.querySelectorAll('[role="menuitemradio"]')).map((item) => item.textContent)).toEqual([
      'За неделю',
      'За 2 недели',
      'За месяц',
    ])
    expect(menu.textContent).toContain('Минусы — не дальше месяца')
  })

  test('narrows a long period to a month when only minuses are chosen', async () => {
    mockSearchParams = new URLSearchParams({ tab: 'received', period: 'year' })
    mockReceivedVotes.mockResolvedValueOnce(page(twoWeeks))
    await render()

    await click(buttonByText('Все оценки'))
    await click(buttonByText('Только минусы'))

    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'received', sign: 'minus', period: 'month' })
  })
})
