import React, { useEffect } from 'react'

import cn from 'classnames'
import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'

import MarkerAPI, { MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import useNoScroll from '../API/use/useNoScroll'
import { useAppState } from '../AppState/AppState'
import Overlay from './Overlay'

import styles from './AddMarkerComponent.module.scss'

interface AddMarkerComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
  onSuccess?: () => void
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
  ({ targetType, targetId, onClose, onSuccess }) => {
    const appState = useAppState()
    const componentState = React.useMemo(() => new AddMarkerComponentState(), [])

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
              console.error('Error fetching token info:', error)
              if (error?.data?.code === 'auth-required') {
                componentState.setError('Authentication required')
                // Redirect to sign-in page after a short delay
                setTimeout(() => {
                  window.location.href = '/signin'
                }, 1000)
              } else {
                componentState.setError('Failed to load token information')
              }
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
        console.error('Error adding marker:', error)
        if (error?.data?.code === 'auth-required') {
          componentState.setError('Authentication required')
          // Redirect to sign-in page after a short delay
          setTimeout(() => {
            window.location.href = '/signin'
          }, 1000)
        } else {
          componentState.setError('Error adding marker: ' + (error?.data?.message || error?.message || 'Unknown error'))
        }
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
                🌟 Star
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
                📰 Note
              </button>

              <button
                className={cn(styles.markerButton, styles.bookmarkButton, {
                  [styles.active]: componentState.selectedType === MarkerType.BOOKMARK,
                })}
                onClick={() => componentState.setSelectedType(MarkerType.BOOKMARK)}
                disabled={componentState.isSubmitting}
                title='Add Bookmark'
              >
                🔖 Bookmark
              </button>
            </div>
          </div>

          <div className={styles.addMarkerForm}>
            <textarea
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
