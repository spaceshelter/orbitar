import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { useDebouncedCallback } from 'use-debounce'

// Shared debounced-filter shell for the profile feeds (posts, comments, votes):
// an uncontrolled search input synced both ways with the `filter` query param.
export function useProfileFeedFilter(buildSearchParams: (filter: string) => Record<string, string>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultFilter = searchParams.get('filter') || ''
  const [filter, setFilter] = useState(defaultFilter)
  const { search } = useLocation()
  const filterInputRef = useRef<HTMLInputElement>(null)

  const applyFilter = (value: string) => {
    setFilter(value)
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
    const nextSearchParams = new URLSearchParams(search)
    const nextFilter = nextSearchParams.get('filter') || ''
    setFilter(nextFilter)
    if (filterInputRef.current) {
      filterInputRef.current.value = nextFilter
    }
    return () => setDebouncedFilter.cancel()
  }, [search, setDebouncedFilter])

  return { filter, defaultFilter, filterInputRef, handleFilterChange }
}
