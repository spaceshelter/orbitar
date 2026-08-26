import React, { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { useDebouncedCallback } from 'use-debounce'

// Shared debounced-filter shell for the profile feeds (posts, comments, votes):
// an uncontrolled search input synced both ways with the `filter` query param.
export function useProfileFeedFilter(buildSearchParams: (filter: string) => Record<string, string>) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Derived straight from the URL: a state copy lags it by one commit, so a tab
  // switch (whose links drop the filter param) would first fire a request for
  // (new tab, stale filter) that the next render immediately aborts.
  const filter = searchParams.get('filter') || ''
  const defaultFilter = filter
  const { search } = useLocation()
  const filterInputRef = useRef<HTMLInputElement>(null)

  const applyFilter = (value: string) => {
    setSearchParams(buildSearchParams(value))
  }

  const setDebouncedFilter = useDebouncedCallback(applyFilter, 1000)

  const handleFilterChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (e.nativeEvent instanceof KeyboardEvent) {
      if (e.nativeEvent.key === 'Enter') {
        setDebouncedFilter.cancel()
        applyFilter(e.currentTarget.value)
      }
      return
    }
    setDebouncedFilter(e.currentTarget.value)
  }

  useEffect(() => {
    setDebouncedFilter.cancel()
    const nextFilter = new URLSearchParams(search).get('filter') || ''
    if (filterInputRef.current) {
      filterInputRef.current.value = nextFilter
    }
    return () => setDebouncedFilter.cancel()
  }, [search, setDebouncedFilter])

  return { filter, defaultFilter, filterInputRef, handleFilterChange }
}
