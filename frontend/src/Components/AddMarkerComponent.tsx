import React, { useEffect } from 'react'

import cn from 'classnames'
import { action, makeObservable, observable } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useHotkeys } from 'react-hotkeys-hook'

import MarkerAPI, { MarkerTargetType, MarkerType, UserTokenInfo } from '../API/MarkerAPI'
import useNoScroll from '../API/use/useNoScroll'
import { useAppState } from '../AppState/AppState'
import { TokenCounts } from '../Types/TokenCounts'
import Overlay from './Overlay'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as NoteIcon } from '../Assets/note.svg'
import { ReactComponent as StarIcon } from '../Assets/star.svg'
import styles from './AddMarkerComponent.module.scss'

interface AddMarkerComponentProps {
  targetType: MarkerTargetType
  targetId: number
  onClose: () => void
  onSuccess?: (tokenCounts: TokenCounts) => void
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

    // Add ESC key handler
    useHotkeys(
      'esc',
      onClose,
      {
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [onClose],
    )

    // Create a ref for the annotation input
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Focus the input when the component mounts
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, [componentState.selectedType])

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

        // Get updated token counts for the target
        const tokenCounts = await MarkerAPI.getTokenCounts(targetType, targetId)

        // Success - close the modal and notify parent with updated token counts
        onSuccess?.(tokenCounts)
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
        <div className={styles.addMarkerContainer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h3>Отметить</h3>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>

          {componentState.error && <div className={styles.error}>{componentState.error}</div>}

          {appState.userInfo && componentState.userTokens !== null && (
            <div className={styles.tokenInfo}>
              Доступно токенов: {componentState.userTokens} / {componentState.maxTokens}
              {componentState.selectedType !== MarkerType.BOOKMARK && (
                <span className={styles.tokenPrice}>
                  Цена: <strong>1</strong> токен
                </span>
              )}
              {componentState.selectedType === MarkerType.BOOKMARK && (
                <span className={styles.tokenPrice}>
                  Цена: <strong className={styles.freePrice}>бесплатно</strong>
                </span>
              )}
            </div>
          )}

          <div className={styles.markerTypeSelector}>
            <h4>Выберите тип:</h4>
            <div className={styles.markerButtons}>
              <button
                className={cn(styles.markerButton, styles.starButton, {
                  [styles.active]: componentState.selectedType === MarkerType.STAR,
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.STAR),
                })}
                onClick={() => componentState.setSelectedType(MarkerType.STAR)}
                disabled={isMarkerTypeDisabled(MarkerType.STAR) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.STAR) ? 'Недостаточно токенов' : 'Добавить звезду'}
              >
                <StarIcon /> Звезда!
              </button>

              <button
                className={cn(styles.markerButton, styles.noteButton, {
                  [styles.active]: componentState.selectedType === MarkerType.NOTE,
                  [styles.disabled]: isMarkerTypeDisabled(MarkerType.NOTE),
                })}
                onClick={() => componentState.setSelectedType(MarkerType.NOTE)}
                disabled={isMarkerTypeDisabled(MarkerType.NOTE) || componentState.isSubmitting}
                title={isMarkerTypeDisabled(MarkerType.NOTE) ? 'Недостаточно токенов' : 'Добавить заметку'}
              >
                <NoteIcon /> Заметка
              </button>

              <button
                className={cn(styles.markerButton, styles.bookmarkButton, {
                  [styles.active]: componentState.selectedType === MarkerType.BOOKMARK,
                })}
                onClick={() => componentState.setSelectedType(MarkerType.BOOKMARK)}
                disabled={componentState.isSubmitting}
                title='Добавить закладку'
              >
                <BookmarkIcon /> Закладка
              </button>
            </div>

            <div className={styles.markerDescription}>
              {componentState.selectedType === MarkerType.STAR && (
                <>
                  Позитивная награда. Она выделяет контент, позволяет получателю участвовать в лидербордах и номинирует
                  его на премию. К звезде можно добавить аннотацию, которая будет видна всем. Стоит 1 токен.
                </>
              )}
              {componentState.selectedType === MarkerType.NOTE && (
                <>
                  Нейтральная публичная аннотация, видимая всем. Не является наградой, не номинирует на премию и не
                  участвует в лидербордах. Стоит 1 токен.
                </>
              )}
              {componentState.selectedType === MarkerType.BOOKMARK && (
                <>
                  Бесплатная, позволяет вам сохранить контент в свое избранное. Не является наградой или номинацией.
                  Другие люди могут видеть ваши закладки только в вашем профиле.
                </>
              )}
            </div>
          </div>

          <div className={styles.addMarkerForm}>
            <input
              type='text'
              className={styles.annotationInput}
              ref={inputRef}
              value={componentState.annotation}
              onChange={(e) => componentState.setAnnotation(e.target.value)}
              placeholder='Добавить заметку (макс. 256 символов)...'
              maxLength={256}
              disabled={componentState.isSubmitting}
              onKeyDown={(e) => {
                // Submit on Enter
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddMarker()
                }
              }}
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={onClose} disabled={componentState.isSubmitting}>
              Отмена
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
              {componentState.isSubmitting ? 'Добавление...' : 'Добавить отметку'}
            </button>
          </div>
        </div>
      </>
    )
  },
)

export default AddMarkerComponent
