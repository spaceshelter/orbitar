import React, { useEffect, useState } from 'react'

import { useAppState } from '@state/AppState'
import Button from '@ui/Button'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { ReactComponent as ChevronLeft } from '../Assets/chevron-left.svg'
import { ReactComponent as ChevronRight } from '../Assets/chevron-right.svg'
import styles from './GalleryComponent.module.scss'

export interface ImageItem {
  src: string
  alt?: string
}

export interface GalleryElement {
  image?: ImageItem
  htmlElement?: HTMLElement
  isVideo?: boolean
  element?: React.ReactNode
}

interface GalleryComponentProps {
  elements: GalleryElement[]
  autoPlayInterval?: number
  showThumbnails?: boolean
  showIndicators?: boolean
  showArrows?: boolean
  disableZoom?: boolean
  onChangeIndex?: (index: number) => void
  className?: string
}

const GalleryComponent: React.FC<GalleryComponentProps> = ({
  elements,
  autoPlayInterval = 0,
  showThumbnails = false,
  showIndicators = false,
  showArrows = false,
  disableZoom = false,
  onChangeIndex,
  className,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0)

  const [touchStart, setTouchStart] = useState<number>(0)
  const [touchEnd, setTouchEnd] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [imageLarge, setImageLarge] = useState<boolean>(false)
  const [maxHeight, setMaxHeight] = useState<number>(0)

  const appState = useAppState()

  const getLegacyZoom = (): boolean => {
    const legacy = localStorage.getItem('legacyZoom')
    return legacy === 'true'
  }

  const minSwipeDistance = 50

  const goToPrevious = (e: React.MouseEvent | undefined = undefined): void => {
    if (isTransitioning) return

    const newIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1
    goToSlide(newIndex, e)
  }

  const goToNext = (e: React.MouseEvent | undefined = undefined): void => {
    if (isTransitioning) return

    const newIndex = currentIndex === elements.length - 1 ? 0 : currentIndex + 1
    goToSlide(newIndex, e)
  }

  const goToSlide = (index: number, e: React.MouseEvent | undefined = undefined): void => {
    if (isTransitioning || index === currentIndex) return
    e?.stopPropagation()

    const direction = index > currentIndex ? 'left' : 'right'
    setSlideDirection(direction)
    setIsTransitioning(true)
    onChangeIndex?.(index)

    setTimeout(() => {
      setSlideDirection(null)
      setIsTransitioning(false)
      setCurrentIndex(index)
    }, 300)
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
    const img = e.currentTarget
    if (!maxHeight) {
      setMaxHeight(img.clientHeight)
    }

    if (!getLegacyZoom() && appState.zoomedImg) {
      appState.setZoomedImg({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        goLeft: goToPrevious,
        goRight: goToNext,
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent): void => {
    if (isTransitioning) return
    setTouchEnd(0)
    setTouchStart(e.targetTouches[0].clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (!isDragging || isTransitioning) return
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = (): void => {
    if (!touchStart || !touchEnd || !isDragging || isTransitioning) {
      setIsDragging(false)
      return
    }

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNext()
    } else if (isRightSwipe) {
      goToPrevious()
    }

    setIsDragging(false)
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement, MouseEvent>): void => {
    if (imageLarge || disableZoom) return

    const img = e.currentTarget

    if (getLegacyZoom()) {
      setImageLarge(!imageLarge)
    } else {
      appState.setZoomedImg({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        goLeft: goToPrevious,
        goRight: goToNext,
      })
    }
  }

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      if (isTransitioning || !appState.zoomedImg) return

      if (event.key === 'ArrowLeft') {
        goToPrevious()
      } else if (event.key === 'ArrowRight') {
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isTransitioning])

  useEffect(() => {
    if (!autoPlayInterval || autoPlayInterval <= 0 || isTransitioning) return

    const interval = setInterval(() => {
      goToNext()
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [autoPlayInterval, currentIndex, isTransitioning])

  if (!elements || elements.length === 0) {
    return (
      <div className={classNames(styles.gallery, className)}>
        <div className={styles.noImages}>А где все картинки?</div>
      </div>
    )
  }

  const currentElement = elements[currentIndex]

  return (
    <div className={classNames(styles.gallery, className)}>
      <div
        className={classNames(styles.main, {
          [styles.dragging]: isDragging,
          [styles.slideLeft]: slideDirection === 'left',
          [styles.slideRight]: slideDirection === 'right',
          [styles.transitioning]: isTransitioning,
        })}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={maxHeight ? { height: `${maxHeight}px` } : {}}
      >
        <span className={styles.mediaContainer}>
          <GalleryElement
            image={currentElement.image}
            htmlElement={currentElement.htmlElement}
            isVideo={currentElement.isVideo}
            element={currentElement.element}
            handleImageClick={handleImageClick}
            handleImageLoad={handleImageLoad}
            imageLarge={imageLarge}
            disableZoom={disableZoom}
          />
        </span>

        {showIndicators && (
          <div className={styles.indicators}>
            {elements.map((_, index) => (
              <Button
                key={index}
                onClick={(e: React.MouseEvent) => goToSlide(index, e)}
                className={classNames(styles.indicator, { [styles.indicatorActive]: index === currentIndex })}
                aria-label={`Перейти к изображению ${index + 1}`}
                disabled={isTransitioning}
              >
                <span className={styles.indicatorDot}></span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {showArrows && (
        <>
          <Button
            onClick={goToPrevious}
            className={classNames(styles.arrow, styles.arrowPrev)}
            aria-label='Предыдущее изображение'
            disabled={isTransitioning}
          >
            <ChevronLeft />
          </Button>

          <Button
            onClick={goToNext}
            className={classNames(styles.arrow, styles.arrowNext)}
            aria-label='Следующее изображение'
            disabled={isTransitioning}
          >
            <ChevronRight />
          </Button>
        </>
      )}

      {currentElement.image?.alt && <div className={styles.caption}>{currentElement.image.alt}</div>}

      {showThumbnails && (
        <div className={styles.thumbnails}>
          {elements.map((el, index) => (
            <Button
              key={index}
              onClick={(e: React.MouseEvent) => goToSlide(index, e)}
              className={classNames(styles.thumbnail, {
                [styles.thumbnailActive]: index === currentIndex,
                [styles.thumbnailVideo]: el.isVideo,
              })}
              aria-label={`Миниатюра ${index + 1}`}
              disabled={isTransitioning}
            >
              <img src={el.image?.src} alt={el.image?.alt} className={styles.thumbnailImage} />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

interface GalleryElementProps {
  image?: ImageItem
  htmlElement?: HTMLElement
  isVideo?: boolean
  element?: React.ReactNode
  handleImageClick: (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => void
  handleImageLoad: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  imageLarge?: boolean
  disableZoom?: boolean
}

function GalleryElement(props: GalleryElementProps): JSX.Element {
  const { isVideo, image, htmlElement, element, handleImageClick, handleImageLoad, imageLarge, disableZoom } = props

  if (isVideo && htmlElement) {
    return (
      <span
        ref={(ref) => {
          if (ref && htmlElement && !ref.contains(htmlElement)) {
            ref.innerHTML = ''
            ref.appendChild(htmlElement)
          }
        }}
      ></span>
    )
  }

  if (image) {
    return (
      <img
        src={image.src}
        alt={image.alt}
        className={classNames(styles.image, !disableZoom && 'image-scalable', imageLarge && 'image-preview')}
        onClick={handleImageClick}
        onLoad={handleImageLoad}
      />
    )
  }

  return <>{element}</>
}

export default observer(GalleryComponent)
