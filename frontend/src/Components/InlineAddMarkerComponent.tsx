import React, { useCallback, useEffect, useRef, useState } from 'react'

import cn from 'classnames'
import { observer } from 'mobx-react-lite'
import { useHotkeys } from 'react-hotkeys-hook'

import { MarkerInfo, MarkerTargetType, MarkerType } from '../API/MarkerAPI'
import useNoScroll from '../API/use/useNoScroll'
import { usePrevious } from '../API/use/usePrevious'
import { useAppState } from '../AppState/AppState'
import { TokenCounts } from '../Types/TokenCounts'
import { pluralize } from '../Utils/utils'
import Overlay from './Overlay'
import TokenIcon from './TokenIcon'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as InfoIcon } from '../Assets/info.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './AddMarkerComponent.module.scss'

// Extracted component for the marker info modal
interface MarkerInfoModalProps {
  onClose: () => void
}

export const MarkerInfoModal: React.FC<MarkerInfoModalProps> = ({ onClose }) => {
  // Prevent scrolling when modal is open
  useNoScroll()

  // Add ESC key handler
  useHotkeys('esc', onClose, { enableOnFormTags: true }, [onClose])

  // Create inline style to match TokenCounters icon size
  const iconStyle = {
    width: '22px',
    height: '22px',
    fill: 'currentColor',
    position: 'relative' as const,
    top: '2px',
    marginRight: '2px',
    verticalAlign: 'text-bottom',
  }

  return (
    <>
      <Overlay onClick={onClose} />
      <div className={styles.addMarkerContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Отметки и токены</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.markerDescription}>
          <p>Позволяют отмечать и сохранять интересные материалы и награждать пользователей:</p>
          <ul>
            <li>
              <strong>
                <StarIcon style={iconStyle} /> Звезда
              </strong>{' '}
              - Позитивная награда. Она выделяет контент, позволяет получателю участвовать в лидербордах и номинирует
              его на премию. К звезде можно добавить аннотацию, которая будет видна всем. Стоит токен.
            </li>
            <li>
              <strong>
                <NoteIcon style={iconStyle} /> Заметка
              </strong>{' '}
              - Нейтральная публичная аннотация, видимая всем. Не является наградой, не номинирует на премию и не
              участвует в лидербордах. Стоит токен.
            </li>
            <li>
              <strong>
                <BookmarkIcon style={iconStyle} /> Закладка
              </strong>{' '}
              - Бесплатная, позволяет вам сохранить контент в свое избранное. Не является наградой или номинацией.
              Другие люди могут видеть ваши закладки только в вашем профиле.
            </li>
          </ul>
          <p>
            <strong>
              <TokenIcon /> Токены{' '}
            </strong>
            - Выдаются активным полноправным пользователям, накопить можно ограниченное количество.
          </p>
          <p>Прототип: в будущем планируется только одна аннотация от пользователя к одному контенту.</p>
        </div>
      </div>
    </>
  )
}

interface InlineAddMarkerComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
  onSuccess?: (tokenCounts: TokenCounts) => void
  initialMarkerType?: MarkerType
  ownMarkers?: MarkerInfo[]
  onExternalAction?: (action: 'add' | 'remove', cost: number) => void
}

export const InlineAddMarkerComponent = observer(
  React.forwardRef<
    { showTokenAnimation: (action: 'add' | 'remove', amount: number) => void },
    InlineAddMarkerComponentProps
  >(({ targetType, targetId, onClose, onSuccess, initialMarkerType, ownMarkers = [], onExternalAction }, ref) => {
    const appState = useAppState()
    const markerAPI = appState.api.markerAPI
    const [isLoading, setIsLoading] = useState(false)
    const [, setSelectedType] = useState<MarkerType>(initialMarkerType || MarkerType.STAR)
    const [ownMarkersByType, setOwnMarkersByType] = useState<Record<MarkerType, MarkerInfo | undefined>>({
      [MarkerType.STAR]: undefined,
      [MarkerType.NOTE]: undefined,
      [MarkerType.BOOKMARK]: undefined,
    })
    const [annotation, setAnnotation] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [availableTokens, setAvailableTokens] = useState<number | null>(null)
    const [lastActionCost, setLastActionCost] = useState<number | null>(null)

    // Create a ref for the annotation input
    const inputRef = useRef<HTMLInputElement>(null)

    // Handle ESC key to close
    useHotkeys('esc', onClose, { enableOnFormTags: true }, [onClose])

    // Helper function to find highest priority marker type (lowest number: star > note > bookmark)
    const getHighestPriorityMarkerType = (markers: Record<MarkerType, MarkerInfo | undefined>): MarkerType | null => {
      if (markers[MarkerType.STAR]) return MarkerType.STAR
      if (markers[MarkerType.NOTE]) return MarkerType.NOTE
      if (markers[MarkerType.BOOKMARK]) return MarkerType.BOOKMARK
      return null
    }

    // Process own markers on init and changes
    useEffect(() => {
      const markersByType: Record<MarkerType, MarkerInfo | undefined> = {
        [MarkerType.STAR]: undefined,
        [MarkerType.NOTE]: undefined,
        [MarkerType.BOOKMARK]: undefined,
      }

      // Find user's own markers for each type
      ownMarkers.forEach((marker) => {
        if (!marker.removedAt) {
          markersByType[marker.markerType] = marker
        }
      })

      setOwnMarkersByType(markersByType)

      // Set initial annotation from highest priority marker
      isUserEditedRef.current = false // Mark that this is a programmatic change

      // Find highest priority marker and use its annotation
      const highestPriorityType = getHighestPriorityMarkerType(markersByType)
      if (highestPriorityType) {
        setAnnotation(markersByType[highestPriorityType]?.annotation || '')
        setSelectedType(highestPriorityType)
      } else {
        setAnnotation('')
      }
    }, [ownMarkers, initialMarkerType])

    // Focus the input when component mounts
    useEffect(() => {
      if (inputRef.current && !isLoading) {
        // Only focus on the input if not on a mobile device
        if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          setTimeout(() => {
            inputRef?.current?.focus()
          }, 100)
        }
      }
    }, [inputRef.current, isLoading])

    // Cleanup all timers on unmount
    useEffect(() => {
      return () => {
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current)
          animationTimerRef.current = null
        }
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
      }
    }, [])

    // Fetch token info on mount
    useEffect(() => {
      const fetchTokenInfo = async () => {
        if (!appState.userInfo) return

        try {
          setIsLoading(true)
          const tokenInfo = await markerAPI.getUserTokenInfo()
          setAvailableTokens(tokenInfo.availableTokens)
        } catch (error: any) {
          console.error('Failed to load token information', error)
        } finally {
          setIsLoading(false)
        }
      }

      fetchTokenInfo()
    }, [appState.userInfo, markerAPI])

    const isMarkerTypeDisabled = (type: MarkerType): boolean => {
      if (!appState.userInfo) return false
      if (type === MarkerType.BOOKMARK) return false

      // Check if the user has enough tokens
      return availableTokens !== null && availableTokens < 1
    }

    // Create refs for controlling animation and saving logic
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isSavingRef = useRef(false)
    const isUserEditedRef = useRef(false)

    // Use a counter to force re-render of the animation component
    const [animationKey, setAnimationKey] = useState(0)

    // Track previous annotation to detect user changes vs loaded values
    const prevAnnotation = usePrevious(annotation)

    // Function to show token animation effect - can be called from parent
    const showTokenAnimation = useCallback((action: 'add' | 'remove', amount = 1) => {
      // Clear any existing animation timer
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
        animationTimerRef.current = null
      }

      // Increment key to force re-render of the animation component
      setAnimationKey((prev) => prev + 1)

      // Adding costs tokens (-), removing gives tokens back (+)
      const cost = action === 'add' ? -amount : +amount
      setLastActionCost(cost)

      // Clean up after animation completes
      animationTimerRef.current = setTimeout(() => {
        setLastActionCost(null)
        animationTimerRef.current = null
      }, 2500) // Match CSS animation duration
    }, [])

    // FIXME: HAX!!!
    // Expose showTokenAnimation method via ref
    useEffect(() => {
      if (ref) {
        // Use a cast to handle the different ways of working with refs
        const refObj = ref as React.MutableRefObject<{ showTokenAnimation: typeof showTokenAnimation } | null>
        refObj.current = { showTokenAnimation }

        return () => {
          refObj.current = null
        }
      }
    }, [ref, showTokenAnimation])

    // Save annotation when it changes (with debounce)
    useEffect(() => {
      // Skip empty annotations
      if (!annotation.trim().length) return

      // Skip if this is the first load or if annotation hasn't actually changed
      if (prevAnnotation === undefined) return

      // Skip programmatic changes (like when loading from a marker)
      // Only process changes that were made by the user
      if (!isUserEditedRef.current) return

      // Clear any existing timer to implement debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      // Skip if we're already in the middle of a save operation
      if (isSavingRef.current) return

      // Save current values to use in the async function
      const currentAnnotation = annotation

      const saveAnnotation = async () => {
        try {
          // Mark that we're starting a save operation
          isSavingRef.current = true

          // Get highest priority marker type
          const highestPriorityType = getHighestPriorityMarkerType(ownMarkersByType)

          if (highestPriorityType) {
            // If we have markers, update the highest priority one with the annotation
            const existingMarker = ownMarkersByType[highestPriorityType]

            // API doesn't support directly updating annotations, so remove and recreate
            await markerAPI.removeMarker(existingMarker!.markerId)
            await markerAPI.createMarker(targetType, targetId, highestPriorityType, 1, currentAnnotation.trim())
          } else if (currentAnnotation.trim().length > 0) {
            // If no markers exist and annotation isn't empty, create a bookmark
            await markerAPI.createMarker(targetType, targetId, MarkerType.BOOKMARK, 1, currentAnnotation.trim())
          }

          // Get updated token counts for the target
          const tokenCounts = await markerAPI.getTokenCounts(targetType, targetId)
          onSuccess?.(tokenCounts)

          // Update own markers
          const markers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
          const userMarkers = markers.filter((m) => m.creator.id === appState.userInfo?.id && !m.removedAt)

          // Update own markers state without depending on existing state to break the cycle
          const updatedMarkersByType: Record<MarkerType, MarkerInfo | undefined> = {
            [MarkerType.STAR]: undefined,
            [MarkerType.NOTE]: undefined,
            [MarkerType.BOOKMARK]: undefined,
          }
          userMarkers.forEach((marker) => {
            updatedMarkersByType[marker.markerType] = marker
          })
          setOwnMarkersByType(updatedMarkersByType)

          // Update selected type to highest priority
          const newHighestPriorityType = getHighestPriorityMarkerType(updatedMarkersByType)
          if (newHighestPriorityType) {
            setSelectedType(newHighestPriorityType)
          }
        } catch (error: any) {
          setError('Error saving annotation: ' + (error?.data?.message || error?.message || 'Unknown error'))
        } finally {
          // Clear the saving flag when done
          isSavingRef.current = false
        }
      }

      // Use a debounce to avoid too many save attempts
      debounceTimerRef.current = setTimeout(saveAnnotation, 800)

      // Cleanup function to clear timer on unmount or dependency change
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
      }
    }, [
      // Note: ownMarkersByType is intentionally omitted from dependencies
      // to prevent infinite loops when markers are updated
      annotation,
      prevAnnotation,
      targetType,
      targetId,
      markerAPI,
      onSuccess,
      appState.userInfo,
    ])

    const toggleMarker = async (type: MarkerType) => {
      if (!appState.userInfo) {
        window.location.href = '/signin'
        return
      }

      if (isMarkerTypeDisabled(type) && !ownMarkersByType[type]) return

      try {
        setIsLoading(true)
        setError(null)

        // Check if the user already has this marker type
        const existingMarker = ownMarkersByType[type]

        if (existingMarker) {
          // Remove the marker
          await markerAPI.removeMarker(existingMarker.markerId)

          // Update action cost display
          if (type !== MarkerType.BOOKMARK) {
            showTokenAnimation('remove', 1)
            // Notify parent component if they want to know about token changes
            onExternalAction?.('remove', 1)
          }
        } else {
          // Add the marker
          await markerAPI.createMarker(
            targetType,
            targetId,
            type,
            1,
            annotation.trim().length > 0 ? annotation.trim() : null,
          )

          // Update action cost display
          if (type !== MarkerType.BOOKMARK) {
            showTokenAnimation('add', 1)
            // Notify parent component if they want to know about token changes
            onExternalAction?.('add', 1)
          }
        }

        // Get updated token counts for the target
        const tokenCounts = await markerAPI.getTokenCounts(targetType, targetId)
        onSuccess?.(tokenCounts)

        // Fetch updated token info
        const tokenInfo = await markerAPI.getUserTokenInfo()
        setAvailableTokens(tokenInfo.availableTokens)

        // Update own markers
        const markers = await markerAPI.getMarkersByTarget(targetType, targetId, false)
        const userMarkers = markers.filter((m) => m.creator.id === appState.userInfo?.id && !m.removedAt)

        // Update own markers state
        const updatedMarkersByType: Record<MarkerType, MarkerInfo | undefined> = {
          [MarkerType.STAR]: undefined,
          [MarkerType.NOTE]: undefined,
          [MarkerType.BOOKMARK]: undefined,
        }
        userMarkers.forEach((marker) => {
          updatedMarkersByType[marker.markerType] = marker
        })
        setOwnMarkersByType(updatedMarkersByType)

        // Get highest priority marker and update the annotation
        const highestPriorityType = getHighestPriorityMarkerType(updatedMarkersByType)
        if (highestPriorityType) {
          isUserEditedRef.current = false // Mark this as programmatic change
          setAnnotation(updatedMarkersByType[highestPriorityType]?.annotation || '')
          setSelectedType(highestPriorityType)
        } else {
          isUserEditedRef.current = false // Mark this as programmatic change
          setAnnotation('')
        }
      } catch (error: any) {
        setError('Error toggling marker: ' + (error?.data?.message || error?.message || 'Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    const handleClickType = (type: MarkerType) => {
      // Only toggle marker for the click
      toggleMarker(type)
    }

    const showInfoModal = () => {
      // Use the extracted MarkerInfoModal component
      appState.setModal(<MarkerInfoModal onClose={() => appState.setModal(null)} />)
    }

    return (
      <div className={styles.inlineAddMarker} onClick={(e) => e.stopPropagation()}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.tokenCountsRow}>
          {availableTokens !== null && (
            <span className={styles.tokenCount}>
              <TokenIcon size={16} /> {pluralize(availableTokens, ['токен', 'токена', 'токенов'])}
              {lastActionCost !== null && (
                <span
                  key={animationKey}
                  className={cn(styles.actionCost, {
                    [styles.positive]: lastActionCost > 0,
                    [styles.negative]: lastActionCost < 0,
                  })}
                >
                  ({lastActionCost > 0 ? '+' : ''}
                  {lastActionCost})
                </span>
              )}
            </span>
          )}

          <button className={styles.infoButton} onClick={showInfoModal} title='Информация об отметках'>
            <InfoIcon />
          </button>
        </div>

        <div className={styles.newMarkerLayout}>
          <input
            type='text'
            className={styles.inlineAnnotationInput}
            ref={inputRef}
            value={annotation}
            onChange={(e) => {
              isUserEditedRef.current = true
              setAnnotation(e.target.value)
            }}
            placeholder='аннотация'
            maxLength={256}
            disabled={isLoading}
            onKeyDown={(e) => {
              // Close on Escape
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />

          <div className={styles.markerTypeFilters}>
            <button
              className={cn(styles.markerButton, {
                [styles.active]: !!ownMarkersByType[MarkerType.STAR],
                [styles.disabled]: isMarkerTypeDisabled(MarkerType.STAR) && !ownMarkersByType[MarkerType.STAR],
              })}
              onClick={() => handleClickType(MarkerType.STAR)}
              disabled={isLoading || (isMarkerTypeDisabled(MarkerType.STAR) && !ownMarkersByType[MarkerType.STAR])}
              title={isMarkerTypeDisabled(MarkerType.STAR) ? 'Недостаточно токенов' : 'Наградить звездой'}
            >
              <StarIcon />
            </button>

            <button
              className={cn(styles.markerButton, {
                [styles.active]: !!ownMarkersByType[MarkerType.NOTE],
                [styles.disabled]: isMarkerTypeDisabled(MarkerType.NOTE) && !ownMarkersByType[MarkerType.NOTE],
              })}
              onClick={() => handleClickType(MarkerType.NOTE)}
              disabled={isLoading || (isMarkerTypeDisabled(MarkerType.NOTE) && !ownMarkersByType[MarkerType.NOTE])}
              title={isMarkerTypeDisabled(MarkerType.NOTE) ? 'Недостаточно токенов' : 'Добавить заметку'}
            >
              <NoteIcon />
            </button>

            <button
              className={cn(styles.markerButton, {
                [styles.active]: !!ownMarkersByType[MarkerType.BOOKMARK],
              })}
              onClick={() => handleClickType(MarkerType.BOOKMARK)}
              disabled={isLoading}
              title='Добавить закладку'
            >
              <BookmarkIcon />
            </button>
          </div>
        </div>
      </div>
    )
  }),
)

export default InlineAddMarkerComponent
