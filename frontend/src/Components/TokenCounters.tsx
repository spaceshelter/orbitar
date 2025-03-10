import React, { useState } from 'react'

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

  // Get the counts from the entity or use empty counts
  const displayCounts = counts || { stars: 0, notes: 0, bookmarks: 0 }

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

      {isPopupOpen && (
        <div className={styles.overlayWrapper}>
          {/*<Overlay onClick={handleClosePopup} />*/}
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
