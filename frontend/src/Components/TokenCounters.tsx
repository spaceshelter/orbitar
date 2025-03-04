import React from 'react'

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
  entityType: 'post' | 'comment'
  // If counts are provided, use them; otherwise calculate based on entityId
  counts?: TokenCounts
}

// Helper function to calculate token counts based on entity ID
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

export default function TokenCounters(props: TokenCountersProps) {
  // Use provided counts or calculate them based on entity ID
  const counts = props.counts || calculateTokenCounts(props.entityId)
  const { stars, notes, bookmarks } = counts

  // Nothing to display if all counts are zero
  if (stars === 0 && notes === 0 && bookmarks === 0) {
    return null
  }

  return (
    <div className={styles.tokenCounters}>
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
  )
}
