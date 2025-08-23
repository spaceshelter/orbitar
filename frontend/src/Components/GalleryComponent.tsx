import React, { useEffect, useState } from 'react'

import Button from '@ui/Button'
import classNames from 'classnames'

import { ReactComponent as ChevronLeft } from '../Assets/chevron-left.svg'
import { ReactComponent as ChevronRight } from '../Assets/chevron-right.svg'
import styles from './GalleryComponent.module.scss'

export interface ImageItem {
  src: string
  alt?: string
}

type ZoomedImg = {
  src: string
  width: number
  height: number
}

interface ImageGalleryProps {
  images?: ImageItem[]
  autoPlayInterval?: number
  showThumbnails?: boolean
  showIndicators?: boolean
  showArrows?: boolean
  className?: string
  setZoomedImg?: (img: ZoomedImg | null) => void
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images: propImages,
  autoPlayInterval = 0,
  showThumbnails = true,
  showIndicators = true,
  showArrows = true,
  setZoomedImg,
  className,
}) => {
  const defaultImages: ImageItem[] = []

  const images = propImages || defaultImages
  const [currentIndex, setCurrentIndex] = useState<number>(0)

  const [touchStart, setTouchStart] = useState<number>(0)
  const [touchEnd, setTouchEnd] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [isScalable, setIsScalable] = useState<boolean>(false)
  const [imageLarge, setImageLarge] = useState<boolean>(false)

  const getLegacyZoom = (): boolean => {
    const legacy = localStorage.getItem('legacyZoom')
    return legacy === 'true'
  }

  const minSwipeDistance = 50

  const goToPrevious = (): void => {
    if (isTransitioning) return

    const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1
    setSlideDirection('right')
    setIsTransitioning(true)

    setTimeout(() => handleStopTransition(newIndex), 300)
  }

  const goToNext = (): void => {
    if (isTransitioning) return

    const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1
    setSlideDirection('left')
    setIsTransitioning(true)

    setTimeout(() => handleStopTransition(newIndex), 300)
  }

  const goToSlide = (index: number): void => {
    if (isTransitioning || index === currentIndex) return

    const direction = index > currentIndex ? 'left' : 'right'
    setSlideDirection(direction)
    setIsTransitioning(true)

    setTimeout(() => handleStopTransition(index), 300)
  }

  const handleStopTransition = (index: number): void => {
    setSlideDirection(null)
    setIsTransitioning(false)
    setCurrentIndex(index)
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

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
    const img = e.currentTarget
    if (img.naturalWidth > 800 || img.naturalHeight > 800) {
      setIsScalable(true)
    } else {
      setIsScalable(false)
    }
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement, MouseEvent>): void => {
    if (!isScalable) return

    const img = e.currentTarget
    if (getLegacyZoom()) {
      if (imageLarge) {
        setImageLarge(false)
        return
      }

      setImageLarge(true)
    } else {
      setZoomedImg &&
        setZoomedImg({
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
    }
  }

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      if (isTransitioning) return

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

  if (!images || images.length === 0) {
    return (
      <div className={classNames(styles.gallery, className)}>
        <div className={styles.noImages}>А где все картинки?</div>
      </div>
    )
  }

  const currentImage = images[currentIndex]

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
      >
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          className={classNames(styles.mainImage, isScalable && 'image-scalable', imageLarge && 'image-preview')}
          onClick={handleImageClick}
          onLoad={handleImageLoad}
        />

        {showArrows && images.length > 1 && (
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

        {showIndicators && images.length > 1 && (
          <div className={styles.indicators}>
            {images.map((_, index) => (
              <Button
                key={index}
                onClick={() => goToSlide(index)}
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

      {currentImage.alt && <div className={styles.caption}>{currentImage.alt}</div>}

      {showThumbnails && images.length > 1 && (
        <div className={styles.thumbnails}>
          {images.map((image, index) => (
            <Button
              key={index}
              onClick={() => goToSlide(index)}
              className={classNames(styles.thumbnail, { [styles.thumbnailActive]: index === currentIndex })}
              aria-label={`Миниатюра ${index + 1}`}
              disabled={isTransitioning}
            >
              <img src={image.src} alt={image.alt} className={styles.thumbnailImage} />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
