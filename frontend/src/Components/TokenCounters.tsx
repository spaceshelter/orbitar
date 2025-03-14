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

    // Position the popup
    const counterRect = counterRef.current.getBoundingClientRect()
    const popupEl = popupRef.current

    // Get popup dimensions
    const popupWidth = 312 // Match the width from CSS
    const popupHeight = Math.min(400, window.innerHeight * 0.8) // Limit height on small screens

    // Check available space in all directions
    const belowSpace = window.innerHeight - (counterRect.bottom + window.scrollY)
    const aboveSpace = counterRect.top - window.scrollY
    const rightSpace = window.innerWidth - counterRect.left
    const leftSpace = counterRect.right

    // Decide vertical position
    if (belowSpace >= popupHeight || aboveSpace < popupHeight) {
      // Position below if there's enough space or if there's not enough space above
      popupEl.style.top = `${counterRect.bottom + window.scrollY + 5}px` // Add a small gap
      popupEl.style.bottom = 'auto'
    } else {
      // Position above
      popupEl.style.bottom = `${window.innerHeight - counterRect.top + 5}px` // Add a small gap
      popupEl.style.top = 'auto'
    }

    // Decide horizontal position
    // On mobile, center under the counter if possible
    const isMobile = window.innerWidth < 768

    if (isMobile) {
      // Center the popup under the counter on mobile, but keep it within viewport
      const idealLeft = Math.max(
        10,
        Math.min(window.innerWidth - popupWidth - 10, counterRect.left - (popupWidth / 2 - counterRect.width / 2)),
      )
      popupEl.style.left = `${idealLeft}px`
      popupEl.style.right = 'auto'
    } else if (rightSpace >= popupWidth || leftSpace < popupWidth) {
      // Align to the left if there's enough space on the right or not enough on the left
      popupEl.style.left = `${counterRect.left}px`
      popupEl.style.right = 'auto'
    } else {
      // Align to the right
      popupEl.style.right = `${window.innerWidth - counterRect.right}px`
      popupEl.style.left = 'auto'
    }

    // Close popup when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !counterRef.current?.contains(event.target as Node)
      ) {
        setIsPopupOpen(false)
      }
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
