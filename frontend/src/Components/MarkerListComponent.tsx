import React, { useEffect, useRef } from 'react'

import cn from 'classnames'
import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'

import { MarkerInfo, MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import { useAppState } from '../AppState/AppState'
import { TokenCounts } from '../Types/TokenCounts'
import AddMarkerComponent from './AddMarkerComponent'
import DateComponent from './DateComponent'
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

    useEffect(() => {
      const fetchMarkers = async () => {
        try {
          componentState.setIsLoading(true)
          const markers = await markerAPI.getMarkersByTarget(targetType, targetId, true)
          componentState.setMarkers(markers)

          if (appState.userInfo) {
            try {
              const tokenInfo = await markerAPI.getUserTokenInfo()
              componentState.setTokenInfo(tokenInfo)
            } catch (error) {
              console.error('Error fetching token info:', error)
            }
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

        await markerAPI.removeMarker(markerId)

        // Refresh the markers
        const markers = await markerAPI.getMarkersByTarget(targetType, targetId, true)
        componentState.setMarkers(markers)

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

    const isMarkerTypeDisabled = (type: MarkerType): boolean => {
      if (!appState.userInfo) return false
      if (type === MarkerType.BOOKMARK) return false

      // Check if the user has enough tokens
      return componentState.userTokens !== null && componentState.userTokens < 1
    }
    const handleOpenAddMarker = (type: MarkerType) => {
      componentState.setSelectedMarkerType(type)

      const handleAddMarkerSuccess = async (tokenCounts: TokenCounts) => {
        // Refresh the markers
        const markers = await markerAPI.getMarkersByTarget(targetType, targetId, true)
        componentState.setMarkers(markers)

        // Notify parent component about the updated token counts
        if (onUpdate) {
          onUpdate(tokenCounts)
        }

        // Refresh token info
        const tokenInfo = await markerAPI.getUserTokenInfo()
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
        {/*<div className={styles.header}>*/}
        {/*  <h3>Отметки</h3>*/}
        {/*</div>*/}

        {componentState.error && <div className={styles.error}>{componentState.error}</div>}

        {appState.userInfo && (
          <div className={styles.addMarkerRow}>
            {/*<span className={styles.addMarkerLabel}>Добавить отметку:</span>*/}
            <div className={styles.addMarkerButtons}>
              <button
                className={cn(styles.markerButton, styles.starButton, {
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.STAR),
                })}
                onClick={() => handleOpenAddMarker(MarkerType.STAR)}
                disabled={isMarkerTypeDisabled(MarkerType.STAR) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.STAR) ? 'Недостаточно токенов' : 'Наградить звездой'}
              >
                <StarIcon /> наградить
              </button>

              <button
                className={cn(styles.markerButton, styles.noteButton, {
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.NOTE),
                })}
                onClick={() => handleOpenAddMarker(MarkerType.NOTE)}
                disabled={isMarkerTypeDisabled(MarkerType.NOTE) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.NOTE) ? 'Недостаточно токенов' : 'Заметка для всех'}
              >
                <NoteIcon /> заметка
              </button>

              <button
                className={cn(styles.markerButton, styles.bookmarkButton)}
                onClick={() => handleOpenAddMarker(MarkerType.BOOKMARK)}
                disabled={componentState.isSubmitting}
                title='Добавить в закладки себе'
              >
                <BookmarkIcon /> в закладки
              </button>
            </div>
          </div>
        )}

        {componentState.isLoading ? (
          <div className={styles.loading}>Загрузка отметок...</div>
        ) : (
          <div className={styles.markersList}>
            {starMarkers.map((marker) => (
              <div key={marker.markerId} className={styles.markerItem}>
                <div className={styles.markerType}>
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
                <div className={styles.markerType}>
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
