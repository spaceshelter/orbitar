import React, { useEffect } from 'react'

import cn from 'classnames'
import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'

import MarkerAPI, { MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import useNoScroll from '../API/use/useNoScroll'
import { useAppState } from '../AppState/AppState'
import Overlay from './Overlay'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './AddMarkerComponent.module.scss'

interface AddMarkerComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
  onSuccess?: () => void
  initialMarkerType?: MarkerType
}

class AddMarkerComponentState {
  @observable
  isLoading = true

  @observable
  selectedType: MarkerType = MarkerType.STAR

  @observable
  annotation = ''

  @observable
  isSubmitting = false

  @observable
  userTokens: number | null = null

  @observable
  maxTokens: number | null = null

  @observable
  error: string | null = null

  constructor() {
    makeObservable(this)
  }

  @action
  setIsLoading(value: boolean) {
    this.isLoading = value
  }

  @action
  setSelectedType(type: MarkerType) {
    this.selectedType = type
  }

  @action
  setAnnotation(annotation: string) {
    this.annotation = annotation
  }

  @action
  setIsSubmitting(value: boolean) {
    this.isSubmitting = value
  }

  @action
  setTokenInfo(info: UserTokenInfo | null) {
    if (info) {
      this.userTokens = info.availableTokens
      this.maxTokens = info.maxTokens
    } else {
      this.userTokens = null
      this.maxTokens = null
    }
  }

  @action
  setError(error: string | null) {
    this.error = error
  }
}

export const AddMarkerComponent: React.FC<AddMarkerComponentProps> = observer(
  ({ targetType, targetId, onClose, onSuccess, initialMarkerType }) => {
    const appState = useAppState()
    const componentState = React.useMemo(() => {
      const state = new AddMarkerComponentState()
      if (initialMarkerType) {
        state.setSelectedType(initialMarkerType)
      }
      return state
    }, [initialMarkerType])

    // Prevent scrolling when modal is open
    useNoScroll()

    useEffect(() => {
      const fetchTokenInfo = async () => {
        try {
          componentState.setIsLoading(true)

          if (appState.userInfo) {
            try {
              const tokenInfo = await MarkerAPI.getUserTokenInfo()
              componentState.setTokenInfo(tokenInfo)
            } catch (error: any) {
              componentState.setError('Failed to load token information')
            }
          }
        } finally {
          componentState.setIsLoading(false)
        }
      }

      fetchTokenInfo()
    }, [appState.userInfo, componentState])

    const handleAddMarker = async () => {
      if (!appState.userInfo) {
        window.location.href = '/signin'
        return
      }

      try {
        componentState.setIsSubmitting(true)
        componentState.setError(null)

        await MarkerAPI.createMarker(
          targetType,
          targetId,
          componentState.selectedType,
          1,
          componentState.annotation.trim() || null,
        )

        // Success - close the modal and notify parent
        onSuccess?.()
        onClose()
      } catch (error: any) {
        componentState.setError('Error adding marker: ' + (error?.data?.message || error?.message || 'Unknown error'))
      } finally {
        componentState.setIsSubmitting(false)
      }
    }

    const isMarkerTypeDisabled = (type: MarkerType): boolean => {
      if (!appState.userInfo) return false
      if (type === MarkerType.BOOKMARK) return false

      // Check if the user has enough tokens
      return componentState.userTokens !== null && componentState.userTokens < 1
    }

    return (
      <>
        <Overlay onClick={onClose} />
        <div className={styles.addMarkerContainer}>
          <div className={styles.header}>
            <h3>Add Marker</h3>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>

          {componentState.error && <div className={styles.error}>{componentState.error}</div>}

          {appState.userInfo && componentState.userTokens !== null && (
            <div className={styles.tokenInfo}>
              Available tokens: {componentState.userTokens} / {componentState.maxTokens}
            </div>
          )}

          <div className={styles.markerTypeSelector}>
            <h4>Select Marker Type</h4>
            <div className={styles.markerButtons}>
              <button
                className={cn(styles.markerButton, styles.starButton, {
                  [styles.active]: componentState.selectedType === MarkerType.STAR,
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.STAR),
                })}
                onClick={() => componentState.setSelectedType(MarkerType.STAR)}
                disabled={isMarkerTypeDisabled(MarkerType.STAR) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.STAR) ? 'Not enough tokens' : 'Add Star'}
              >
                <StarIcon /> Star
              </button>

              <button
                className={cn(styles.markerButton, styles.noteButton, {
                  [styles.active]: componentState.selectedType === MarkerType.NOTE,
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.NOTE),
                })}
                onClick={() => componentState.setSelectedType(MarkerType.NOTE)}
                disabled={isMarkerTypeDisabled(MarkerType.NOTE) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.NOTE) ? 'Not enough tokens' : 'Add Note'}
              >
                <NoteIcon /> Note
              </button>

              <button
                className={cn(styles.markerButton, styles.bookmarkButton, {
                  [styles.active]: componentState.selectedType === MarkerType.BOOKMARK,
                })}
                onClick={() => componentState.setSelectedType(MarkerType.BOOKMARK)}
                disabled={componentState.isSubmitting}
                title='Add Bookmark'
              >
                <BookmarkIcon /> Bookmark
              </button>
            </div>

            <div className={styles.markerDescription}>
              {componentState.selectedType === MarkerType.STAR && (
                <>
                  A Star marker is positive and costs one token. It nominates content for awards, appears in
                  leaderboards, and highlights the content.
                </>
              )}
              {componentState.selectedType === MarkerType.NOTE && (
                <>
                  A Note marker is for sharing public annotations with others. It costs one token but doesn't nominate
                  for awards or appear in leaderboards.
                </>
              )}
              {componentState.selectedType === MarkerType.BOOKMARK && (
                <>
                  A Bookmark marker is free and personal. Bookmarks are only visible to you on the content, but others
                  can see your bookmarks in your profile.
                </>
              )}
            </div>
          </div>

          <div className={styles.addMarkerForm}>
            <input
              type='text'
              className={styles.annotationInput}
              value={componentState.annotation}
              onChange={(e) => componentState.setAnnotation(e.target.value)}
              placeholder='Add optional note (max 256 characters)...'
              maxLength={256}
              disabled={componentState.isSubmitting}
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={onClose} disabled={componentState.isSubmitting}>
              Cancel
            </button>
            <button
              className={styles.addButton}
              onClick={handleAddMarker}
              disabled={
                componentState.isSubmitting ||
                (componentState.selectedType !== MarkerType.BOOKMARK &&
                  componentState.userTokens !== null &&
                  componentState.userTokens < 1)
              }
            >
              {componentState.isSubmitting ? 'Adding...' : 'Add Marker'}
            </button>
          </div>
        </div>
      </>
    )
  },
)

export default AddMarkerComponent
