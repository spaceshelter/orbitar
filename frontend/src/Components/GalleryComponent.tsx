import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useAppState } from '@state/AppState'
import Button from '@ui/Button'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { getLegacyZoom } from './UserProfileSettings'

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
  disableDynamicHeight?: boolean
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
  disableDynamicHeight = false,
  onChangeIndex,
  className,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [translateX, setTranslateX] = useState<number>(0)
  const [touchStart, setTouchStart] = useState<number>(0)
  const [touchEnd, setTouchEnd] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [optimalHeight, setOptimalHeight] = useState<number>(500)

  const [dragStartX, setDragStartX] = useState<number>(0)
  const [isDragMouse, setIsDragMouse] = useState<boolean>(false)
  const [dragActivated, setDragActivated] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const maxHeight = 500
  const fallbackElementHeight = 400

  const dragThreshold = 10
  const containerWidth = containerRef.current?.offsetWidth || 0
  const minSwipeDistance = containerWidth > 0 ? containerWidth / 5 : 50

  const calculateOptimalHeight = useCallback(async (): Promise<number> => {
    if (disableDynamicHeight) {
      return maxHeight
    }

    const containerWidth = containerRef.current?.offsetWidth || 0
    if (!containerWidth || !elements.length) {
      return maxHeight
    }

    const calculateElementHeight = async (element: GalleryElement) => {
      if (element.image?.src) {
        return new Promise<number>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const aspectRatio = img.naturalHeight / img.naturalWidth
            const calculatedHeight = Math.min(containerWidth * aspectRatio, maxHeight)
            resolve(calculatedHeight)
          }
          img.onerror = () => resolve(fallbackElementHeight)
          img.src = element.image!.src
        })
      } else if (element.htmlElement) {
        const elementHeight = element.htmlElement.offsetHeight || fallbackElementHeight
        return Math.min(elementHeight, maxHeight)
      } else {
        return fallbackElementHeight
      }
    }

    const calculatedHeights = await Promise.all(elements.map((element) => calculateElementHeight(element)))

    const maxCalculatedHeight = Math.max(...calculatedHeights)
    return Math.min(maxCalculatedHeight, maxHeight)
  }, [elements, disableDynamicHeight])

  useEffect(() => {
    if (disableDynamicHeight) return

    const updateHeight = async () => {
      const height = await calculateOptimalHeight()
      setOptimalHeight(height)
    }

    // delay for the container to be rendered
    const timeoutId = setTimeout(updateHeight, 100)

    return () => clearTimeout(timeoutId)
  }, [elements, calculateOptimalHeight, disableDynamicHeight])

  useEffect(() => {
    if (disableDynamicHeight) return

    const handleResize = async () => {
      const height = await calculateOptimalHeight()
      setOptimalHeight(height)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateOptimalHeight, disableDynamicHeight])

  const goToPrevious = (e: React.MouseEvent | undefined = undefined): void => {
    if (isTransitioning) return
    e?.stopPropagation()

    goToSlide(currentIndex - 1)
  }

  const goToNext = (e: React.MouseEvent | undefined = undefined): void => {
    if (isTransitioning) return
    e?.stopPropagation()

    goToSlide(currentIndex + 1)
  }

  const goToSlide = (index: number): void => {
    if (isTransitioning || index === currentIndex || index < 0 || currentIndex >= elements.length) return

    setIsTransitioning(true)
    const direction = index > currentIndex ? -1 : 1
    const targetTranslate = direction * containerWidth

    setTranslateX(targetTranslate)

    setTimeout(() => {
      setCurrentIndex(index)
      setTranslateX(0)
      setIsTransitioning(false)
      onChangeIndex?.(index)
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent): void => {
    if (isTransitioning) return
    const touch = e.targetTouches[0]
    setTouchStart(touch.clientX)
    setTouchEnd(0)
    setIsDragging(true)
    setDragActivated(false)
  }

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (!isDragging || isTransitioning) return
    const touch = e.targetTouches[0]
    setTouchEnd(touch.clientX)

    const diff = Math.abs(touch.clientX - touchStart)

    if (!dragActivated && diff > dragThreshold) {
      setDragActivated(true)
      e.cancelable && e.preventDefault()
    }

    if (dragActivated) {
      const moveX = touch.clientX - touchStart
      const newTranslateX = Math.max(Math.min(moveX, containerWidth * 0.8), -containerWidth * 0.8)
      setTranslateX(newTranslateX)
    }
  }

  const handleTouchEnd = (): void => {
    if (!isDragging || isTransitioning) {
      setIsDragging(false)
      setDragActivated(false)
      return
    }

    // tap
    if (!dragActivated) {
      setIsDragging(false)
      setDragActivated(false)
      return
    }

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < elements.length - 1) {
      goToNext()
    } else if (isRightSwipe && currentIndex > 0) {
      goToPrevious()
    } else {
      setTranslateX(0)
    }

    setIsDragging(false)
    setDragActivated(false)
  }

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (isTransitioning) return
    setDragStartX(e.clientX)
    setIsDragMouse(true)
    setDragActivated(false)
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (!isDragMouse || isTransitioning) return

    const diff = Math.abs(e.clientX - dragStartX)

    if (!dragActivated && diff > dragThreshold) {
      setDragActivated(true)
      e.preventDefault()
    }

    if (dragActivated) {
      const moveX = e.clientX - dragStartX
      const newTranslateX = Math.max(Math.min(moveX, containerWidth * 0.8), -containerWidth * 0.8)
      setTranslateX(newTranslateX)
    }
  }

  const handleMouseUp = (e: React.MouseEvent): void => {
    if (!isDragMouse || isTransitioning) {
      setIsDragMouse(false)
      setDragActivated(false)
      return
    }

    // click
    if (!dragActivated) {
      setIsDragMouse(false)
      setDragActivated(false)
      return
    }

    const distance = dragStartX - e.clientX
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < elements.length - 1) {
      goToNext()
    } else if (isRightSwipe && currentIndex > 0) {
      goToPrevious()
    } else {
      setTranslateX(0)
    }

    setIsDragMouse(false)
    setDragActivated(false)
  }

  const handleMouseLeave = (): void => {
    if (isDragMouse) {
      if (dragActivated) {
        setTranslateX(0)
      }
      setIsDragMouse(false)
      setDragActivated(false)
    }
  }

  const getPrevIndex = () => {
    return currentIndex === 0 ? elements.length - 1 : currentIndex - 1
  }

  const getNextIndex = () => {
    return currentIndex === elements.length - 1 ? 0 : currentIndex + 1
  }

  useEffect(() => {
    if (!autoPlayInterval || autoPlayInterval <= 0 || isTransitioning || dragActivated) return

    const interval = setInterval(() => {
      goToNext()
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [goToNext, autoPlayInterval, currentIndex, isTransitioning, dragActivated])

  if (!elements || elements.length === 0) {
    return (
      <div className={classNames(styles.gallery, className)}>
        <div className={styles.noImages}>Сюда можно вставить файл.</div>
      </div>
    )
  }

  return (
    <div className={classNames(styles.gallery, className)}>
      <div
        ref={containerRef}
        className={classNames(styles.main, {
          [styles.dragging]: dragActivated,
          [styles.transitioning]: isTransitioning,
        })}
        style={{
          height: disableDynamicHeight ? undefined : `${optimalHeight}px`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={styles.slidesContainer}
          style={{
            transform: `translateX(calc(-33.333% + ${translateX}px))`,
            transition:
              isTransitioning && !isDragging ? 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          }}
        >
          <div className={styles.slide}>
            {currentIndex > 0 ? <GalleryElement {...elements[getPrevIndex()]} disableZoom={disableZoom} /> : null}
          </div>

          <div className={styles.slide}>
            <GalleryElement {...elements[currentIndex]} disableZoom={disableZoom} />
          </div>

          <div className={styles.slide}>
            {currentIndex < elements.length - 1 ? (
              <GalleryElement {...elements[getNextIndex()]} disableZoom={disableZoom} />
            ) : null}
          </div>
        </div>

        {showArrows && currentIndex !== 0 && (
          <Button
            onClick={goToPrevious}
            className={classNames(styles.arrow, styles.arrowPrev)}
            aria-label='Предыдущее изображение'
            disabled={isTransitioning}
          >
            <ChevronLeft />
          </Button>
        )}

        {showArrows && currentIndex !== elements.length - 1 && (
          <Button
            onClick={goToNext}
            className={classNames(styles.arrow, styles.arrowNext)}
            aria-label='Следующее изображение'
            disabled={isTransitioning}
          >
            <ChevronRight />
          </Button>
        )}

        {showIndicators && (
          <div className={styles.indicators}>
            {elements.map((_, index) => (
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

      {elements[currentIndex]?.image?.alt && <div className={styles.caption}>{elements[currentIndex]?.image?.alt}</div>}

      {showThumbnails && (
        <div className={styles.thumbnails}>
          {elements.map((el, index) => (
            <Button
              key={index}
              onClick={() => goToSlide(index)}
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
  disableZoom?: boolean
}

function GalleryElement({ isVideo, image, htmlElement, element, disableZoom }: GalleryElementProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const appState = useAppState()

  const [imageLarge, setImageLarge] = useState<boolean>(false)

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement, MouseEvent>): void => {
    if (disableZoom) return

    const img = e.currentTarget

    if (getLegacyZoom()) {
      setImageLarge(!imageLarge)
    } else {
      if (!getLegacyZoom() && !appState.zoomedImg) {
        appState.setZoomedImg({
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
    }
  }

  useEffect(() => {
    if (isVideo && htmlElement && ref?.current && !ref.current.contains(htmlElement)) {
      ref.current.innerHTML = ''
      ref.current.appendChild(htmlElement)
    }

    ref.current?.querySelectorAll('a').forEach((a) => {
      a.setAttribute('unselectable', 'on')
      a.setAttribute('draggable', 'false')
      a.ondragstart = function () {
        return false
      }
    })
  }, [ref, isVideo, htmlElement])

  if (isVideo && htmlElement) {
    return <span ref={ref} className={styles.noDragging}></span>
  }

  if (image) {
    return (
      <img
        src={image.src}
        alt={image.alt}
        className={classNames(
          styles.image,
          styles.noDragging,
          !disableZoom && 'image-scalable',
          imageLarge && 'image-preview',
        )}
        onClick={handleImageClick}
      />
    )
  }

  return (
    <span ref={ref} className={styles.noDragging}>
      {element}
    </span>
  )
}

export default observer(GalleryComponent)
