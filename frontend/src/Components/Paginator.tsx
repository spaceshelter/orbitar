import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import classNames from 'classnames'

import styles from './Paginator.module.scss'

interface PaginatorProps {
  page: number
  pages: number
  base: string
  queryStringParams?: Record<string, string>
}

const NAV_BUTTONS_COUNT = 4
const MAX_ELLIPSES = 2

function getGapWidth(): number {
  const width = window.innerWidth
  if (width <= 400) return 3
  if (width <= 600) return 4
  return 5
}

function getDefaultButtonWidth(): number {
  const width = window.innerWidth
  if (width <= 400) return 20
  if (width <= 600) return 24
  if (width <= 768) return 28
  return 32
}

function calculateMaxPageRange(
  containerWidth: number,
  buttonWidth: number,
  ellipsisWidth: number,
  gapWidth: number,
): number {
  const navButtonsWidth = buttonWidth * NAV_BUTTONS_COUNT + gapWidth * (NAV_BUTTONS_COUNT - 1)
  const ellipsisSpace = (ellipsisWidth + gapWidth) * MAX_ELLIPSES
  const widthForPages = containerWidth - navButtonsWidth - ellipsisSpace
  const maxButtons = Math.floor(widthForPages / (buttonWidth + gapWidth))

  return Math.max(1, maxButtons)
}

export default function Paginator(props: PaginatorProps) {
  const { page, base, queryStringParams, pages } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState(7)

  useEffect(() => {
    const updateRange = () => {
      if (!containerRef.current) return

      const containerWidth = containerRef.current.offsetWidth
      const pageButton = containerRef.current.querySelector(`.${styles.page}`) as HTMLElement
      const ellipsis = containerRef.current.querySelector(`.${styles.ellipsis}`) as HTMLElement

      const defaultWidth = getDefaultButtonWidth()
      const buttonWidth = pageButton?.offsetWidth ?? defaultWidth
      const ellipsisWidth = ellipsis?.offsetWidth ?? defaultWidth
      const gapWidth = getGapWidth()

      const maxRange = calculateMaxPageRange(containerWidth, buttonWidth, ellipsisWidth, gapWidth)
      const calculatedRange = Math.min(maxRange, pages)

      setRange(calculatedRange)
    }

    const timeoutId = setTimeout(updateRange, 0)
    const resizeObserver = new ResizeObserver(updateRange)

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [pages])

  if (pages <= 1) return null

  const { pageMin, pageMax } = calculatePageRange(page, pages, range)
  const pageProps = { base, params: queryStringParams || {}, currentPage: page }

  return (
    <div ref={containerRef} className={styles.paginator}>
      <Page page={1} disabled={page === 1} {...pageProps}>
        ⇤
      </Page>
      <Page page={page - 1} disabled={page === 1} {...pageProps}>
        ←
      </Page>

      {pageMin > 1 && <span className={styles.ellipsis}>…</span>}

      {Array.from({ length: pageMax - pageMin + 1 }, (_, i) => pageMin + i).map((i) => (
        <Page key={i} page={i} current={i === page} disabled={i === page} {...pageProps}>
          {i}
        </Page>
      ))}

      {pageMax < pages && <span className={styles.ellipsis}>…</span>}

      <Page page={page + 1} disabled={page === pages} {...pageProps}>
        →
      </Page>
      <Page page={pages} disabled={page === pages} {...pageProps}>
        ⇥
      </Page>
    </div>
  )
}

function calculatePageRange(currentPage: number, totalPages: number, range: number) {
  const halfRange = Math.floor(range / 2)

  let pageMin = Math.max(1, currentPage - halfRange)
  let pageMax = Math.min(currentPage + halfRange - ((range + 1) % 2), totalPages)

  if (pageMax - pageMin + 1 < range) {
    if (pageMin === 1) {
      pageMax = Math.min(range, totalPages)
    } else {
      pageMin = Math.max(pageMax - range + 1, 1)
    }
  }

  return { pageMin, pageMax }
}

interface PageProps {
  disabled?: boolean
  children: React.ReactNode
  base: string
  params: Record<string, string>
  page: number
  current?: boolean
}

function Page(props: PageProps) {
  const { disabled, children, base, params, page, current } = props
  const search = new URLSearchParams(params)
  if (page !== 1) {
    search.set('page', page.toString())
  }
  return (
    <Link
      className={classNames(styles.page, { [styles.disabled]: disabled, [styles.current]: current })}
      to={{ pathname: base, search: search.toString() }}
    >
      {children}
    </Link>
  )
}
