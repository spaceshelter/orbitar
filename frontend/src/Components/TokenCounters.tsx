import React, { useRef, useState } from 'react'

import { observer } from 'mobx-react-lite'

import { MarkerTargetType } from '../API/MarkerAPI'
import { TokenCounts } from '../Types/TokenCounts'
import { MarkerListComponent } from './MarkerListComponent'
import TokenIcon from './TokenIcon'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './TokenCounters.module.scss'

type TokenCountersProps = {
  entityId: number
  entityType: 'post' | 'comment' | 'user'
  // Counts from the entity
  counts: TokenCounts | undefined
  // Optional callback when the marker list is opened/closed
  onListToggle?: (isOpen: boolean) => void
  // Optional callback when token counts are updated
  onUpdate?: (counts: TokenCounts) => void
  // Current user's vote value: undefined (no vote), -1 (downvote), 1 (upvote)
  userVote?: number
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

  // If there are no tokens but the entity has been voted on by the current user,
  // we'll still show a faint icon based on vote direction
  const hasNoTokens = stars === 0 && notes === 0 && bookmarks === 0

  const handleTogglePopup = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Toggle popup open/closed state
    const newState = !isPopupOpen
    setIsPopupOpen(newState)

    // Notify parent about popup state change
    props.onListToggle?.(newState)
  }

  const handleClosePopup = () => {
    setIsPopupOpen(false)

    // Notify parent that popup is closed
    props.onListToggle?.(false)
  }

  const handleMarkerUpdated = (updatedCounts: TokenCounts) => {
    // Update the counts via callback
    props.onUpdate?.(updatedCounts)
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

        {/* Show token sphere when there are no counts and no vote indicator */}
        {hasNoTokens && (
          <div className={styles.tokenCounter}>
            <span className={styles.tokenSphere}>
              <TokenIcon size={16} highlightOnHover={true} />
            </span>
          </div>
        )}
      </div>

      <div ref={popupRef} className={styles.markerListWrapper}>
        {isPopupOpen && (
          <MarkerListComponent
            targetType={mapEntityTypeToTargetType(entityType)}
            targetId={entityId}
            onClose={handleClosePopup}
            onUpdate={handleMarkerUpdated}
          />
        )}
      </div>
    </div>
  )
})

export default TokenCounters
