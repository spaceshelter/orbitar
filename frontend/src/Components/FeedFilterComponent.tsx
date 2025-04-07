import React, { useRef } from 'react'

import { useDebouncedCallback } from 'use-debounce'

import { MarkerType } from '../API/MarkerAPI'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './FeedFilterComponent.module.scss'

type FeedFilterProps = {
  filter: string
  markerTypes: MarkerType[]
  onFilterChange: (value: string) => void
  onMarkerToggle: (type: MarkerType) => void
  defaultFilter?: string
}

export default function FeedFilterComponent({
  filter,
  markerTypes,
  onFilterChange,
  onMarkerToggle,
  defaultFilter = '',
}: FeedFilterProps) {
  const filterInputRef = useRef<HTMLInputElement>(null)

  const setDebouncedFilter = useDebouncedCallback((value: string) => {
    onFilterChange(value)
  }, 1000)

  const handleFilterChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.key === 'Enter') {
      const value = e.currentTarget.value
      onFilterChange(value)
    } else {
      setDebouncedFilter(e.currentTarget.value)
    }
  }

  return (
    <div className={styles.filterRow}>
      <input
        ref={filterInputRef}
        onKeyUp={handleFilterChange}
        onChange={handleFilterChange}
        placeholder={'фильтровать'}
        type='search'
        defaultValue={defaultFilter}
        className={styles.filterInput}
      />
      <div className={styles.markerTypeFilters}>
        <button
          className={`${styles.markerButton} ${markerTypes.includes(MarkerType.STAR) ? styles.active : ''}`}
          onClick={() => onMarkerToggle(MarkerType.STAR)}
          title='Фильтр по звездам'
        >
          <StarIcon />
        </button>
        <button
          className={`${styles.markerButton} ${markerTypes.includes(MarkerType.NOTE) ? styles.active : ''}`}
          onClick={() => onMarkerToggle(MarkerType.NOTE)}
          title='Фильтр по заметкам'
        >
          <NoteIcon />
        </button>
        <button
          className={`${styles.markerButton} ${markerTypes.includes(MarkerType.BOOKMARK) ? styles.active : ''}`}
          onClick={() => onMarkerToggle(MarkerType.BOOKMARK)}
          title='Фильтр по закладкам'
        >
          <BookmarkIcon />
        </button>
      </div>
    </div>
  )
}
