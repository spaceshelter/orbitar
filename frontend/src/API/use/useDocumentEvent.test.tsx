import React from 'react'

import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import useDocumentEvent from './useDocumentEvent'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Listener({ listener, enabled }: { listener: (event: KeyboardEvent) => void; enabled?: boolean }) {
  useDocumentEvent('keydown', listener, enabled)
  return null
}

describe('useDocumentEvent', () => {
  let root: Root

  const render = (element: React.ReactElement) =>
    act(() => {
      root.render(element)
    })
  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key }))

  beforeEach(() => {
    root = createRoot(document.createElement('div'))
  })

  test('calls the latest listener while enabled and stops when disabled or unmounted', () => {
    const first = jest.fn()
    const second = jest.fn()

    render(<Listener listener={first} />)
    press('a')
    render(<Listener listener={second} />)
    press('b')
    render(<Listener listener={second} enabled={false} />)
    press('c')
    render(<Listener listener={second} enabled />)
    act(() => root.unmount())
    press('d')

    expect(first.mock.calls.map(([event]) => event.key)).toEqual(['a'])
    expect(second.mock.calls.map(([event]) => event.key)).toEqual(['b'])
  })
})
