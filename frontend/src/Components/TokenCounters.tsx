import React, { useEffect, useRef, useState } from 'react'

import { observer } from 'mobx-react-lite'

import { MarkerTargetType } from '../API/MarkerAPI'
import { TokenCounts } from '../Types/TokenCounts'
import { MarkerListComponent } from './MarkerListComponent'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './TokenCounters.module.scss'

type TokenCountersProps = {
  entityId: number
  entityType: 'post' | 'comment' | 'user'
  // Counts from the entity
  counts: TokenCounts | undefined
}

// Temporary fallback function until all markers are stored properly
// Helper to check if an entity has stars based on tokenCounts
export function hasStars(tokenCounts?: TokenCounts): boolean {
  return !!tokenCounts && tokenCounts.stars > 0
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
  const { entityId, entityType, counts } = props
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const counterRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Get the counts from the entity or use empty counts
  const displayCounts = counts || { stars: 0, notes: 0, bookmarks: 0 }

  const { stars, notes, bookmarks } = displayCounts

  // Nothing to display if all counts are zero
  if (stars === 0 && notes === 0 && bookmarks === 0) {
    return null
  }

  useEffect(() => {
    if (!isPopupOpen || !counterRef.current || !popupRef.current) {
      return
    }

    const [popupEl, ratingEl] = [popupRef.current, counterRef.current]

    const rect = ratingEl.getBoundingClientRect()
    const y = rect.y + window.scrollY || 0
    const rh = ratingEl.clientHeight
    const ph = popupEl.clientHeight

    // Following RatingSwitch positioning logic
    const isTotalHeightMoreThanPageHeight = y + rh + ph > document.documentElement.scrollHeight
    if (isTotalHeightMoreThanPageHeight) {
      popupEl.style.bottom = '30px'
      popupEl.style.top = 'auto'
    } else {
      popupEl.style.top = '30px'
      popupEl.style.bottom = 'auto'
    }

    // Close popup when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !counterRef.current?.contains(e.target as Node)
      ) {
        setIsPopupOpen(false)
      }
      return false
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPopupOpen, counterRef, popupRef])

  const handleTogglePopup = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPopupOpen(!isPopupOpen)
  }

  const handleClosePopup = () => {
    setIsPopupOpen(false)
  }

  return (
    <div className={styles.tokenCountersWrapper}>
      <div ref={counterRef} className={styles.tokenCounters} onClick={handleTogglePopup}>
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

      {isPopupOpen && (
        <div ref={popupRef} className={styles.markerListWrapper}>
          <MarkerListComponent
            targetType={mapEntityTypeToTargetType(entityType)}
            targetId={entityId}
            onClose={handleClosePopup}
          />
        </div>
      )}
    </div>
  )
})

export default TokenCounters
