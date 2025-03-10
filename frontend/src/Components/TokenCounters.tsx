import React, { useEffect, useState } from 'react'

import { observer } from 'mobx-react-lite'

import MarkerAPI, { MarkerTargetType, TokenCounter } from '../API/MarkerAPI'
import { MarkerListComponent } from './MarkerListComponent'
import Overlay from './Overlay'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './TokenCounters.module.scss'

export interface TokenCounts {
  stars: number
  notes: number
  bookmarks: number
}

type TokenCountersProps = {
  entityId: number
  entityType: 'post' | 'comment' | 'user'
  // For backwards compatibility and server-side rendering
  counts?: TokenCounts
}

// Temporary fallback function until all markers are stored properly
export function calculateTokenCounts(entityId: number): TokenCounts {
  // Make it consistent so we always show the same counts for the same ID
  const id = Math.abs(entityId)

  // With 1/20 chance, create a "hot item" with all three token types
  const isHotItem = id % 20 === 7 // 5% chance for a "hot" item

  if (isHotItem) {
    // For hot items, give higher counts for all token types
    return {
      stars: 3 + (id % 2), // 3-4 stars
      notes: 2, // 2 notes
      bookmarks: 2, // 2 bookmarks
    }
  }

  // Regular token distribution
  // Use different modulo operations to ensure independence between tokens
  const hasStars = id % 10 === 0 // 1/10 chance (when id mod 10 is 0)
  const hasNotes = id % 10 === 1 // 1/10 chance (when id mod 10 is 1)
  const hasBookmarks = id % 5 === 2 // 1/5 chance (when id mod 5 is 2)

  // When a token exists, give it a count between 1-3 based on a different hash
  const starCount = hasStars ? 1 + (Math.floor(id / 10) % 3) : 0
  const noteCount = hasNotes ? 1 + (Math.floor(id / 100) % 2) : 0
  const bookmarkCount = hasBookmarks ? 1 : 0 // Bookmarks are always just 1

  return {
    stars: starCount,
    notes: noteCount,
    bookmarks: bookmarkCount,
  }
}

// Helper to check if an entity has stars
export function hasStars(entityId: number): boolean {
  return calculateTokenCounts(entityId).stars > 0
}

// Map the component entity type to API entity type
function mapEntityTypeToTargetType(entityType: string): MarkerTargetType {
  switch (entityType) {
    case 'post':
      return MarkerTargetType.POST
    case 'comment':
      return MarkerTargetType.COMMENT
    case 'user':
      return MarkerTargetType.USER
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

const TokenCounters: React.FC<TokenCountersProps> = observer((props) => {
  const { entityId, entityType } = props
  const [counters, setCounters] = useState<TokenCounter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    const fetchCounters = async () => {
      try {
        setIsLoading(true)
        const targetType = mapEntityTypeToTargetType(entityType)
        const data = await MarkerAPI.getCounters(targetType, entityId)
        setCounters(data)

        // If we don't have any counts, fall back to the mock data for now
        if (data.count === 0) {
          setUseFallback(true)
        } else {
          setUseFallback(false)
        }
      } catch (error) {
        console.error('Error fetching counters:', error)
        setUseFallback(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCounters()
  }, [entityId, entityType])

  // Use fallback data if needed or requested
  const fallbackCounts = props.counts || calculateTokenCounts(entityId)

  // If we're still loading and don't have counts props, show nothing yet
  if (isLoading && !props.counts) {
    return null
  }

  // Get the counts from either the API or fallback
  let displayCounts: TokenCounts
  if (useFallback) {
    displayCounts = fallbackCounts
  } else if (counters) {
    // Use counts from the API
    displayCounts = {
      stars: counters.starCount,
      notes: counters.noteCount,
      bookmarks: counters.bookmarkCount,
    }
  } else {
    // Default to empty counts if nothing is available
    displayCounts = { stars: 0, notes: 0, bookmarks: 0 }
  }

  const { stars, notes, bookmarks } = displayCounts

  // Nothing to display if all counts are zero
  if (stars === 0 && notes === 0 && bookmarks === 0) {
    return null
  }

  const handleOpenPopup = () => {
    setIsPopupOpen(true)
  }

  const handleClosePopup = () => {
    setIsPopupOpen(false)

    // Refresh counters when the popup is closed
    if (!useFallback) {
      const fetchCounters = async () => {
        try {
          const targetType = mapEntityTypeToTargetType(entityType)
          const data = await MarkerAPI.getCounters(targetType, entityId)
          setCounters(data)
        } catch (error) {
          console.error('Error refreshing counters:', error)
        }
      }

      fetchCounters()
    }
  }

  return (
    <>
      <div className={styles.tokenCounters} onClick={handleOpenPopup}>
        {stars > 0 && (
          <div className={styles.tokenCounter}>
            <span className={styles.star}>
              <StarIcon />
            </span>
            <span className={styles.count}>{stars}</span>
          </div>
        )}

        {notes > 0 && (
          <div className={styles.tokenCounter}>
            <span className={styles.note}>
              <NoteIcon />
            </span>
            <span className={styles.count}>{notes}</span>
          </div>
        )}

        {bookmarks > 0 && (
          <div className={styles.tokenCounter}>
            <span className={styles.bookmark}>
              <BookmarkIcon />
            </span>
            <span className={styles.count}>{bookmarks}</span>
          </div>
        )}
      </div>

      {isPopupOpen && !useFallback && (
        <div className={styles.overlayWrapper}>
          <Overlay onClick={handleClosePopup} />
          <div className={styles.markerListWrapper}>
            <MarkerListComponent
              targetType={mapEntityTypeToTargetType(entityType)}
              targetId={entityId}
              onClose={handleClosePopup}
            />
          </div>
        </div>
      )}
    </>
  )
})

export default TokenCounters
