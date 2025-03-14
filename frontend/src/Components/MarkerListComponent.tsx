import React, { useEffect, useRef } from 'react'

import cn from 'classnames'
import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'

import MarkerAPI, { MarkerInfo, MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import { useAppState } from '../AppState/AppState'
import AddMarkerComponent from './AddMarkerComponent'
import Username from './Username'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './MarkerListComponent.module.scss'

interface MarkerListComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
}

class MarkerListComponentState {
  @observable
  isLoading = true

  @observable
  markers: MarkerInfo[] = []

  @observable
  error: string | null = null

  @observable
  selectedType: MarkerType | 'all' = 'all'

  @observable
  isSubmitting = false

  @observable
  userTokens: number | null = null

  @observable
  maxTokens: number | null = null

  @observable
  selectedMarkerType: MarkerType | null = null

  constructor() {
    makeObservable(this)
  }

  @action
  setIsLoading(value: boolean) {
    this.isLoading = value
  }

  @action
  setMarkers(markers: MarkerInfo[]) {
    this.markers = markers
  }

  @action
  setError(error: string | null) {
    this.error = error
  }

  @action
  setSelectedType(type: MarkerType | 'all') {
    this.selectedType = type
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
  setSelectedMarkerType(type: MarkerType | null = null) {
    this.selectedMarkerType = type
  }
}

export const MarkerListComponent: React.FC<MarkerListComponentProps> = observer(({ targetType, targetId, onClose }) => {
  const appState = useAppState()
  const componentState = React.useMemo(() => new MarkerListComponentState(), [])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        componentState.setIsLoading(true)
        const markers = await MarkerAPI.getMarkersByTarget(targetType, targetId, true)
        componentState.setMarkers(markers)

        if (appState.userInfo) {
          try {
            const tokenInfo = await MarkerAPI.getUserTokenInfo()
            componentState.setTokenInfo(tokenInfo)
          } catch (error) {
            console.error('Error fetching token info:', error)
          }
        }
      } catch (error) {
        componentState.setError('Error fetching markers')
        console.error('Error fetching markers:', error)
      } finally {
        componentState.setIsLoading(false)
      }
    }

    fetchMarkers()
  }, [targetType, targetId, componentState, appState.userInfo])

  useEffect(() => {
    if (!listRef.current) {
      return
    }

    // Handle click outside to close the marker list
    const handleOutsideClick = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [listRef, onClose])

  const handleRemoveMarker = async (markerId: number) => {
    try {
      componentState.setIsSubmitting(true)

      await MarkerAPI.removeMarker(markerId)

      // Refresh the markers
      const markers = await MarkerAPI.getMarkersByTarget(targetType, targetId, true)
      componentState.setMarkers(markers)

      // Refresh token info
      const tokenInfo = await MarkerAPI.getUserTokenInfo()
      componentState.setTokenInfo(tokenInfo)
    } catch (error) {
      componentState.setError('Error removing marker')
      console.error('Error removing marker:', error)
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

  const userHasMarkerOfType = (type: MarkerType): boolean => {
    if (!appState.userInfo) return false
    return componentState.markers.some(
      (marker) => marker.markerType === type && marker.creatorId === appState.userInfo?.id && !marker.removedAt,
    )
  }

  const handleOpenAddMarker = (type: MarkerType) => {
    componentState.setSelectedMarkerType(type)

    const handleAddMarkerSuccess = async () => {
      // Refresh the markers
      const markers = await MarkerAPI.getMarkersByTarget(targetType, targetId, true)
      componentState.setMarkers(markers)

      // Refresh token info
      const tokenInfo = await MarkerAPI.getUserTokenInfo()
      componentState.setTokenInfo(tokenInfo)
    }

    appState.setModal(
      <AddMarkerComponent
        targetType={targetType}
        targetId={targetId}
        onClose={() => appState.setModal(undefined)}
        onSuccess={handleAddMarkerSuccess}
        initialMarkerType={type}
      />,
    )
  }

  // Don't prevent clicks inside the list from closing it
  const handleListClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Sort markers by type and date (newest first) and filter out removed markers
  const starMarkers = componentState.markers
    .filter((marker) => marker.markerType === MarkerType.STAR && !marker.removedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const noteMarkers = componentState.markers
    .filter((marker) => marker.markerType === MarkerType.NOTE && !marker.removedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const bookmarkMarkers = componentState.markers.filter(
    (marker) => marker.markerType === MarkerType.BOOKMARK && !marker.removedAt,
  )

  return (
    <div ref={listRef} className={styles.markerList} onClick={handleListClick}>
      <div className={styles.header}>
        <h3>Markers</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {componentState.error && <div className={styles.error}>{componentState.error}</div>}

      {appState.userInfo && (
        <div className={styles.addMarkerRow}>
          <span className={styles.addMarkerLabel}>Add marker:</span>
          <div className={styles.addMarkerButtons}>
            <button
              className={cn(styles.markerButton, styles.starButton, {
                [styles.disabled]: isMarkerTypeDisabled(MarkerType.STAR),
                [styles.active]: userHasMarkerOfType(MarkerType.STAR),
              })}
              onClick={() => handleOpenAddMarker(MarkerType.STAR)}
              disabled={isMarkerTypeDisabled(MarkerType.STAR) || componentState.isSubmitting}
              title={isMarkerTypeDisabled(MarkerType.STAR) ? 'Not enough tokens' : 'Add Star'}
            >
              <StarIcon />
            </button>

            <button
              className={cn(styles.markerButton, styles.noteButton, {
                [styles.disabled]: isMarkerTypeDisabled(MarkerType.NOTE),
                [styles.active]: userHasMarkerOfType(MarkerType.NOTE),
              })}
              onClick={() => handleOpenAddMarker(MarkerType.NOTE)}
              disabled={isMarkerTypeDisabled(MarkerType.NOTE) || componentState.isSubmitting}
              title={isMarkerTypeDisabled(MarkerType.NOTE) ? 'Not enough tokens' : 'Add Note'}
            >
              <NoteIcon />
            </button>

            <button
              className={cn(styles.markerButton, styles.bookmarkButton, {
                [styles.active]: userHasMarkerOfType(MarkerType.BOOKMARK),
              })}
              onClick={() => handleOpenAddMarker(MarkerType.BOOKMARK)}
              disabled={componentState.isSubmitting}
              title='Add Bookmark'
            >
              <BookmarkIcon />
            </button>
          </div>
        </div>
      )}

      {componentState.isLoading ? (
        <div className={styles.loading}>Loading markers...</div>
      ) : (
        <div className={styles.markersList}>
          {starMarkers.length > 0 && (
            <div className={styles.markerSection}>
              <div className={styles.markerSectionHeader}>
                <StarIcon /> Stars
              </div>
              {starMarkers.map((marker) => (
                <div key={marker.markerId} className={styles.markerItem}>
                  <div className={styles.markerSignature}>
                    <StarIcon className={styles.markerIcon} />
                    <Username user={{ username: `user_${marker.creatorId}` }} /> •{' '}
                    <span className={styles.markerDate}>{new Date(marker.createdAt).toLocaleString()}</span>
                    {appState.userInfo && marker.creatorId === appState.userInfo?.id && (
                      <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveMarker(marker.markerId)}
                        disabled={componentState.isSubmitting}
                        title='Remove marker'
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {marker.annotation && <div className={styles.markerAnnotation}>{marker.annotation}</div>}
                </div>
              ))}
            </div>
          )}

          {noteMarkers.length > 0 && (
            <div className={styles.markerSection}>
              <div className={styles.markerSectionHeader}>
                <NoteIcon /> Notes
              </div>
              {noteMarkers.map((marker) => (
                <div key={marker.markerId} className={styles.markerItem}>
                  <div className={styles.markerSignature}>
                    <NoteIcon className={styles.markerIcon} />
                    <Username user={{ username: `user_${marker.creatorId}` }} /> •{' '}
                    <span className={styles.markerDate}>{new Date(marker.createdAt).toLocaleString()}</span>
                    {appState.userInfo && marker.creatorId === appState.userInfo?.id && (
                      <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveMarker(marker.markerId)}
                        disabled={componentState.isSubmitting}
                        title='Remove marker'
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {marker.annotation && <div className={styles.markerAnnotation}>{marker.annotation}</div>}
                </div>
              ))}
            </div>
          )}

          {bookmarkMarkers.length > 0 && (
            <div className={styles.markerSection}>
              <div className={styles.markerSectionHeader}>
                <BookmarkIcon /> Bookmarks
              </div>
              <div className={styles.bookmarksList}>
                {bookmarkMarkers.map((marker) => (
                  <div key={marker.markerId} className={styles.bookmarkItem}>
                    <Username user={{ username: `user_${marker.creatorId}` }} />
                    {appState.userInfo && marker.creatorId === appState.userInfo?.id && (
                      <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveMarker(marker.markerId)}
                        disabled={componentState.isSubmitting}
                        title='Remove bookmark'
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {componentState.markers.length === 0 && <div className={styles.noMarkers}>No markers found</div>}
        </div>
      )}
    </div>
  )
})

export default MarkerListComponent
