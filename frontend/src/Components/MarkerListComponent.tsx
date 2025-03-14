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

  const filteredMarkers =
    componentState.selectedType === 'all'
      ? componentState.markers
      : componentState.markers.filter((marker) => {
          if (componentState.selectedType === MarkerType.STAR && marker.markerType === MarkerType.STAR) return true
          if (componentState.selectedType === MarkerType.NOTE && marker.markerType === MarkerType.NOTE) return true
          if (componentState.selectedType === MarkerType.BOOKMARK && marker.markerType === MarkerType.BOOKMARK)
            return true
          return false
        })

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

  const getMarkerTypeLabel = (marker: MarkerInfo): string => {
    switch (marker.markerType) {
      case MarkerType.STAR:
        return 'Star'
      case MarkerType.NOTE:
        return 'Note'
      case MarkerType.BOOKMARK:
        return 'Bookmark'
      default:
        return 'Unknown Marker'
    }
  }

  const getMarkerIcon = (type: MarkerType) => {
    switch (type) {
      case MarkerType.STAR:
        return <StarIcon />
      case MarkerType.NOTE:
        return <NoteIcon />
      case MarkerType.BOOKMARK:
        return <BookmarkIcon />
      default:
        return null
    }
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

  return (
    <div ref={listRef} className={styles.markerList} onClick={handleListClick}>
      <div className={styles.header}>
        <h3>Markers</h3>
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

      <div className={styles.filterButtons}>
        <button
          className={cn(styles.filterButton, { [styles.active]: componentState.selectedType === 'all' })}
          onClick={() => componentState.setSelectedType('all')}
        >
          All
        </button>
        <button
          className={cn(styles.filterButton, { [styles.active]: componentState.selectedType === MarkerType.STAR })}
          onClick={() => componentState.setSelectedType(MarkerType.STAR)}
        >
          Stars
        </button>
        <button
          className={cn(styles.filterButton, { [styles.active]: componentState.selectedType === MarkerType.NOTE })}
          onClick={() => componentState.setSelectedType(MarkerType.NOTE)}
        >
          Notes
        </button>
        <button
          className={cn(styles.filterButton, {
            [styles.active]: componentState.selectedType === MarkerType.BOOKMARK,
          })}
          onClick={() => componentState.setSelectedType(MarkerType.BOOKMARK)}
        >
          Bookmarks
        </button>
      </div>

      {appState.userInfo && (
        <div className={styles.markerButtons}>
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
      )}

      {componentState.isLoading ? (
        <div className={styles.loading}>Loading markers...</div>
      ) : filteredMarkers.length > 0 ? (
        <div className={styles.markersList}>
          {filteredMarkers.map((marker) => (
            <div key={marker.markerId} className={styles.markerItem}>
              <div className={styles.markerHeader}>
                <span className={styles.markerType}>
                  {getMarkerIcon(marker.markerType)} {getMarkerTypeLabel(marker)}
                </span>
                <span className={styles.markerDate}>{new Date(marker.createdAt).toLocaleString()}</span>
                {appState.userInfo && marker.creatorId === appState.userInfo?.id && (
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveMarker(marker.markerId)}
                    disabled={componentState.isSubmitting}
                    title='Remove marker'
                  >
                    Remove
                  </button>
                )}
              </div>

              {marker.annotation && <div className={styles.markerAnnotation}>{marker.annotation}</div>}

              <div className={styles.markerCreator}>
                by <Username user={{ username: `user_${marker.creatorId}` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noMarkers}>No markers found</div>
      )}
    </div>
  )
})

export default MarkerListComponent
