import React from 'react'

import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import UserProfilePosts from './UserProfilePosts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mockUseFeed = jest.fn()

jest.mock('../API/use/useFeed', () => ({ useFeed: (...args: unknown[]) => mockUseFeed(...args) }))
jest.mock('../AppState/AppState', () => ({ useAPI: () => ({ postAPI: {} }) }))
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams({ page: '7' })],
}))
jest.mock('./useProfileFeedFilter', () => ({
  useProfileFeedFilter: () => ({
    filter: 'ignored in preview',
    defaultFilter: '',
    filterInputRef: { current: null },
    handleFilterChange: jest.fn(),
  }),
}))
jest.mock('./Paginator', () => ({ __esModule: true, default: () => <div data-testid='paginator' /> }))
jest.mock('./PostComponent', () => ({ __esModule: true, default: () => <div data-testid='post' /> }))
jest.mock('./ContentComponent', () => ({ LARGE_AUTO_CUT: 650 }))

describe('UserProfilePosts preview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockUseFeed.mockClear()
    mockUseFeed.mockReturnValue({
      posts: [],
      loading: false,
      pages: 1,
      error: undefined,
      updatePost: jest.fn(),
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  test('loads one latest post without profile-list controls', () => {
    act(() => root.render(<UserProfilePosts username='ginger' preview />))

    expect(mockUseFeed).toHaveBeenCalledWith('ginger', 'user-profile', 1, 1, undefined, undefined, '')
    expect(container.textContent).toContain('Последний пост')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/u/ginger/posts')
    expect(container.querySelector("input[type='search']")).toBeNull()
    expect(container.querySelector("[data-testid='paginator']")).toBeNull()
  })
})
