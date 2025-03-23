import React, { useCallback, useEffect, useRef, useState } from 'react'

import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'

import { MarkerInfo, MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import { useAppState } from '../AppState/AppState'
import { TokenCounts } from '../Types/TokenCounts'
import DateComponent from './DateComponent'
import InlineAddMarkerComponent from './InlineAddMarkerComponent'
import Username from './Username'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './MarkerListComponent.module.scss'

interface MarkerListComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
  onUpdate?: (counts: TokenCounts) => void
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

export const MarkerListComponent: React.FC<MarkerListComponentProps> = observer(
  ({ targetType, targetId, onClose, onUpdate }) => {
    const appState = useAppState()
    const markerAPI = appState.api.markerAPI
    const componentState = React.useMemo(() => new MarkerListComponentState(), [])
    const listRef = useRef<HTMLDivElement>(null)
    const [ownMarkers, setOwnMarkers] = useState<MarkerInfo[]>([])

    useEffect(() => {
      const fetchMarkers = async () => {
        try {
          componentState.setIsLoading(true)
          const markers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
          componentState.setMarkers(markers)

          // Filter to include only user's own markers
          if (appState.userInfo) {
            const userMarkers = markers.filter((m) => m.creator.id === appState.userInfo?.id && !m.removedAt)
            setOwnMarkers(userMarkers)
          }

          try {
            const tokenInfo = await markerAPI.getUserTokenInfo()
            componentState.setTokenInfo(tokenInfo)
          } catch (error) {
            console.error('Error fetching token info:', error)
          }
        } catch (error) {
          componentState.setError('Ошибка загрузки отметок')
          console.error('Error fetching markers:', error)
        } finally {
          componentState.setIsLoading(false)
        }
      }

      fetchMarkers()
    }, [targetType, targetId, componentState, appState.userInfo, markerAPI])

    useEffect(() => {
      if (!listRef.current) {
        return
      }

      // Handle click outside to close the marker list
      const handleOutsideClick = (event: MouseEvent) => {
        // prevent closing if the modal (AddMarker) is open
        if (appState.modal) {
          return
        }

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

        // Get the marker info to know type before removing
        const markers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
        const markerToRemove = markers.find((m) => m.markerId === markerId)

        // Remove the marker
        await markerAPI.removeMarker(markerId)

        // Trigger token animation if applicable (star/note add tokens back when removed)
        if (markerToRemove && markerToRemove.markerType !== MarkerType.BOOKMARK) {
          triggerTokenAnimation('remove', 1)
        }

        // Refresh the markers
        const updatedMarkers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
        componentState.setMarkers(updatedMarkers)

        // Update own markers
        if (appState.userInfo) {
          const userMarkers = updatedMarkers.filter((m) => m.creator.id === appState.userInfo?.id && !m.removedAt)
          setOwnMarkers(userMarkers)
        }

        // Get updated token counts
        const tokenCounts = await markerAPI.getTokenCounts(targetType, targetId)

        // Notify parent component about the updated token counts
        if (onUpdate) {
          onUpdate(tokenCounts)
        }

        // Refresh token info
        const tokenInfo = await markerAPI.getUserTokenInfo()
        componentState.setTokenInfo(tokenInfo)
      } catch (error) {
        componentState.setError('Ошибка удаления отметки')
        console.error('Error removing marker:', error)
      } finally {
        componentState.setIsSubmitting(false)
      }
    }

    const handleMarkerUpdated = async (updatedCounts: TokenCounts) => {
      try {
        // Refresh the markers
        const markers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
        componentState.setMarkers(markers)

        // Update own markers
        if (appState.userInfo) {
          const userMarkers = markers.filter((m) => m.creator.id === appState.userInfo?.id && !m.removedAt)
          setOwnMarkers(userMarkers)
        }

        // Notify parent component about the updated token counts
        if (onUpdate) {
          onUpdate(updatedCounts)
        }

        // Refresh token info
        const tokenInfo = await markerAPI.getUserTokenInfo()
        componentState.setTokenInfo(tokenInfo)
      } catch (error) {
        componentState.setError('Ошибка обновления отметок')
        console.error('Error updating markers:', error)
      }
    }

    // Function to increase marker count for user's own markers
    const handleIncreaseMarkerCount = async (markerType: MarkerType, existingMarker: MarkerInfo) => {
      if (!appState.userInfo || componentState.isSubmitting) {
        return
      }

      if (componentState.userTokens !== null && componentState.userTokens < 1) {
        componentState.setError('Недостаточно токенов')
        return
      }

      try {
        componentState.setIsSubmitting(true)

        // Send placedCount=1 to increment by 1 regardless of current count
        // This avoids issues with the backend potentially interpreting placedCount differently
        await markerAPI.createMarker(
          targetType,
          targetId,
          markerType,
          1, // Always increment by 1
          existingMarker.annotation,
        )

        // Get updated token counts
        const tokenCounts = await markerAPI.getTokenCounts(targetType, targetId)

        // Notify about token consumption for animation in the InlineAddMarkerComponent
        if (markerType !== MarkerType.BOOKMARK) {
          triggerTokenAnimation('add', 1)
        }
        await handleMarkerUpdated(tokenCounts)
      } catch (error) {
        componentState.setError('Ошибка добавления отметки')
        console.error('Error in handleIncreaseMarkerCount:', error)
      } finally {
        componentState.setIsSubmitting(false)
      }
    }

    // Reference to inline component for triggering animations
    const inlineComponentRef = useRef<{
      showTokenAnimation: (action: 'add' | 'remove', amount: number) => void
    } | null>(null)

    // Handle external token actions (used to show animation in InlineAddMarkerComponent)
    const handleExternalAction = useCallback((action: 'add' | 'remove', cost: number) => {
      // The action is handled by the InlineAddMarkerComponent internally
    }, [])

    // Function to trigger token animation in the InlineAddMarkerComponent
    const triggerTokenAnimation = useCallback((action: 'add' | 'remove', cost = 1) => {
      if (inlineComponentRef.current && typeof inlineComponentRef.current.showTokenAnimation === 'function') {
        inlineComponentRef.current.showTokenAnimation(action, cost)
      }
    }, [])
    // Handle list container clicks
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

    // Helper function to check if a marker is owned by the current user
    const isOwnMarker = (marker: MarkerInfo) => {
      return appState.userInfo && marker.creator.id === appState.userInfo.id
    }

    // Separate own bookmarks from other bookmarks
    const ownBookmarkMarker = appState.userInfo
      ? componentState.markers.find(
          (marker) =>
            marker.markerType === MarkerType.BOOKMARK &&
            !marker.removedAt &&
            marker.creator.id === appState.userInfo?.id,
        )
      : undefined

    const otherBookmarkMarkers = componentState.markers.filter(
      (marker) =>
        marker.markerType === MarkerType.BOOKMARK &&
        !marker.removedAt &&
        (!appState.userInfo || marker.creator.id !== appState.userInfo?.id),
    )

    return (
      <div ref={listRef} className={styles.markerList} onClick={handleListClick}>
        {appState.userInfo && (
          <div className={styles.inlineMarkerWrapper}>
            <InlineAddMarkerComponent
              ref={inlineComponentRef}
              targetType={targetType}
              targetId={targetId}
              onClose={() => onClose()}
              onSuccess={handleMarkerUpdated}
              ownMarkers={ownMarkers}
              onExternalAction={handleExternalAction}
            />
          </div>
        )}

        {componentState.error && <div className={styles.error}>{componentState.error}</div>}

        {componentState.isLoading ? (
          <div className={styles.loading}>Загрузка отметок...</div>
        ) : (
          <div className={styles.markersList}>
            {starMarkers.map((marker) => (
              <div key={marker.markerId} className={styles.markerItem}>
                <div
                  className={`${styles.markerType} ${isOwnMarker(marker) ? styles.own : ''}`}
                  onClick={
                    isOwnMarker(marker)
                      ? (e) => {
                          e.stopPropagation()
                          handleIncreaseMarkerCount(MarkerType.STAR, marker)
                        }
                      : undefined
                  }
                  title={isOwnMarker(marker) ? 'Добавить еще одну звезду' : undefined}
                >
                  <StarIcon />
                  {marker.placedCount > 1 && <span className={styles.placedCount}>{marker.placedCount}</span>}
                </div>
                <div className={styles.markerContent}>
                  <div className={styles.markerSignature}>
                    <Username user={{ username: marker.creator.username }} /> •{' '}
                    <DateComponent date={new Date(marker.createdAt)} />
                  </div>
                  {marker.annotation && <div className={styles.markerAnnotation}>{marker.annotation}</div>}
                </div>
                {appState.userInfo && marker.creator.id === appState.userInfo?.id && (
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveMarker(marker.markerId)}
                    disabled={componentState.isSubmitting}
                    title='Удалить отметку'
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {noteMarkers.map((marker) => (
              <div key={marker.markerId} className={styles.markerItem}>
                <div
                  className={`${styles.markerType} ${isOwnMarker(marker) ? styles.own : ''}`}
                  onClick={
                    isOwnMarker(marker)
                      ? (e) => {
                          e.stopPropagation()
                          handleIncreaseMarkerCount(MarkerType.NOTE, marker)
                        }
                      : undefined
                  }
                  title={isOwnMarker(marker) ? 'Добавить еще одну заметку' : undefined}
                >
                  <NoteIcon />
                  {marker.placedCount > 1 && <span className={styles.placedCount}>{marker.placedCount}</span>}
                </div>
                <div className={styles.markerContent}>
                  <div className={styles.markerSignature}>
                    <Username user={{ username: marker.creator.username }} /> •{' '}
                    <DateComponent date={new Date(marker.createdAt)} />
                  </div>
                  {marker.annotation && <div className={styles.markerAnnotation}>{marker.annotation}</div>}
                </div>
                {appState.userInfo && marker.creator.id === appState.userInfo?.id && (
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveMarker(marker.markerId)}
                    disabled={componentState.isSubmitting}
                    title='Удалить отметку'
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* User's own bookmark */}
            {ownBookmarkMarker && (
              <div className={styles.markerItem}>
                <div className={styles.markerType}>
                  <BookmarkIcon />
                </div>
                <div className={styles.markerContent}>
                  <div className={styles.markerSignature}>
                    <Username user={{ username: ownBookmarkMarker.creator.username }} /> •{' '}
                    <DateComponent date={new Date(ownBookmarkMarker.createdAt)} />
                  </div>
                  {ownBookmarkMarker.annotation && (
                    <div className={styles.markerAnnotation}>{ownBookmarkMarker.annotation}</div>
                  )}
                </div>
                <button
                  className={styles.removeButton}
                  onClick={() => handleRemoveMarker(ownBookmarkMarker.markerId)}
                  disabled={componentState.isSubmitting}
                  title='Удалить вашу закладку'
                >
                  ×
                </button>
              </div>
            )}

            {/* Other users' bookmarks */}
            {otherBookmarkMarkers.length > 0 && (
              <div className={styles.markerItem}>
                <div className={styles.markerType}>
                  <BookmarkIcon />
                </div>
                <div className={styles.markerContent}>
                  <div className={styles.bookmarkHeader}>Закладки других пользователей:</div>
                  <div className={styles.bookmarksList}>
                    {otherBookmarkMarkers.map((marker, index) => (
                      <span key={marker.markerId} className={styles.bookmarkItem}>
                        <Username user={{ username: marker.creator.username }} />
                        {index < otherBookmarkMarkers.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {componentState.markers.length === 0 && <div className={styles.noMarkers}>Отметок не найдено</div>}
          </div>
        )}
      </div>
    )
  },
)

export default MarkerListComponent
