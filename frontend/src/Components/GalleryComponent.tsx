import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useNoScroll from '@api/use/useNoScroll'
import useOnBack from '@api/use/useOnBack'
import Button from '@ui/Button'
import classNames from 'classnames'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { observer } from 'mobx-react-lite'
import { useHotkeys } from 'react-hotkeys-hook'
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

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
  onSlideLeave?: (slideElement: HTMLElement) => void
  scrollToIndex?: number
  scrollToKey?: number
  className?: string
  expanded?: boolean
  onExpand?: (index: number) => void
  onCollapse?: () => void
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
  onSlideLeave,
  scrollToIndex,
  scrollToKey,
  className,
  expanded: expandedProp,
  onExpand: onExpandProp,
  onCollapse: onCollapseProp,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [optimalHeight, setOptimalHeight] = useState<number>(500)
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentIndexRef = useRef<number>(0)
  const expandedRef = useRef(false)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)

  // Use external control if provided, otherwise use internal state
  const isControlled = expandedProp !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded

  // Keep ref in sync for use in callbacks that might have stale closures
  expandedRef.current = expanded

  const handleExpand = useCallback(
    (index: number) => {
      // Always notify parent when expanding (used to remove autoCut)
      onExpandProp?.(index)
      if (isControlled) {
        // Controlled mode: parent manages expanded state
      } else {
        setInternalExpanded(true)
      }
    },
    [isControlled, onExpandProp],
  )

  const handleCollapse = useCallback(() => {
    if (isControlled) {
      onCollapseProp?.()
    } else {
      setInternalExpanded(false)
    }
  }, [isControlled, onCollapseProp])

  const maxHeight = 500
  const fallbackElementHeight = 400

  // Disable drag in expanded mode to allow zoom-pan-pinch to work (except for videos)
  const emblaPlugins = useMemo(() => (expanded ? [] : [WheelGesturesPlugin({ forceWheelAxis: 'x' })]), [expanded])

  // Use callback for watchDrag to conditionally enable drag for video slides in expanded mode
  // Note: Using expandedRef instead of expanded to avoid stale closure issues with Embla
  const watchDragHandler = useCallback(
    (_emblaApi: unknown, evt: MouseEvent | TouchEvent) => {
      const isExpanded = expandedRef.current
      if (!isExpanded) return true // Always enable drag when not expanded

      // Check if drag started inside TransformWrapper (images) or VideoSwipeWrapper (videos)
      // These components handle their own swipe detection
      const target = evt.target as HTMLElement
      const isInTransformWrapper = target.closest('.react-transform-wrapper') !== null
      const isInVideoSwipeWrapper = target.closest('.video-swipe-wrapper') !== null

      // If inside a swipe handler → don't handle (let the wrapper do it)
      // If outside → handle with Embla
      return !isInTransformWrapper && !isInVideoSwipeWrapper
    },
    [], // No dependencies - we read from ref
  )

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      dragFree: false,
      containScroll: 'trimSnaps',
      skipSnaps: false,
      watchDrag: watchDragHandler,
    },
    emblaPlugins,
  )

  // Keyboard navigation in expanded mode
  useHotkeys(
    'left',
    () => {
      if (expanded) emblaApi?.scrollPrev()
    },
    { enabled: expanded },
    [expanded, emblaApi],
  )

  useHotkeys(
    'right',
    () => {
      if (expanded) emblaApi?.scrollNext()
    },
    { enabled: expanded },
    [expanded, emblaApi],
  )

  useHotkeys('esc', () => handleCollapse(), { enabled: expanded }, [expanded, handleCollapse])

  // Handle back button in expanded mode
  useOnBack(() => {
    handleCollapse()
  }, expanded)

  // Lock scroll when expanded
  useNoScroll(expanded)

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

  // Embla select event handler
  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap()
      const prevIndex = currentIndexRef.current

      // Stop media in the previous slide when navigating away
      if (onSlideLeave && newIndex !== prevIndex) {
        const slides = emblaApi.slideNodes()
        if (slides[prevIndex]) {
          onSlideLeave(slides[prevIndex])
        }
      }

      currentIndexRef.current = newIndex
      setCurrentIndex(newIndex)
      setCaptionExpanded(false) // Reset caption expanded state on slide change
      onChangeIndex?.(newIndex)
    }

    emblaApi.on('select', onSelect)
    onSelect() // Set initial index

    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onChangeIndex, onSlideLeave])

  // Scroll to index when prop changes
  useEffect(() => {
    if (scrollToIndex !== undefined && emblaApi) {
      setTimeout(() => {
        emblaApi.scrollTo(scrollToIndex)
        setCurrentIndex(scrollToIndex)
      }, 100)
    }
  }, [emblaApi, scrollToIndex, scrollToKey])

  // Autoplay
  useEffect(() => {
    if (!autoPlayInterval || autoPlayInterval <= 0 || !emblaApi) return

    const interval = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext()
      } else {
        emblaApi.scrollTo(0)
      }
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [emblaApi, autoPlayInterval])

  const goToPrevious = useCallback(
    (e: React.MouseEvent | undefined = undefined): void => {
      e?.stopPropagation()
      emblaApi?.scrollPrev()
    },
    [emblaApi],
  )

  const goToNext = useCallback(
    (e: React.MouseEvent | undefined = undefined): void => {
      e?.stopPropagation()
      emblaApi?.scrollNext()
    },
    [emblaApi],
  )

  const goToSlide = useCallback(
    (index: number): void => {
      emblaApi?.scrollTo(index)
    },
    [emblaApi],
  )

  if (!elements || elements.length === 0) {
    return (
      <div className={classNames(styles.gallery, 'gallery', className)}>
        <div className={styles.noImages}>Сюда можно вставить файл.</div>
      </div>
    )
  }

  const CLICK_THRESHOLD = 5 // pixels - if moved more than this, it's a drag not a click

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY }
  }

  // Handle click on overlay/background to collapse
  const handleOverlayClick = (e: React.MouseEvent) => {
    // Check if this was a drag (not a click) by comparing to pointer down position
    if (pointerDownPosRef.current) {
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x)
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y)
      pointerDownPosRef.current = null
      if (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD) {
        return // This was a drag, not a click
      }
    }

    const target = e.target as HTMLElement
    // Don't close if clicking on actual content (images, videos, etc.)
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'IFRAME') {
      return
    }

    // For transform-component, check if click is on empty space (not on the image inside)
    if (target.classList.contains('react-transform-component')) {
      const img = target.querySelector('img')
      if (img) {
        const rect = img.getBoundingClientRect()
        const clickX = e.clientX
        const clickY = e.clientY
        // If click is within image bounds, don't close
        if (clickX >= rect.left && clickX <= rect.right && clickY >= rect.top && clickY <= rect.bottom) {
          return
        }
      }
      handleCollapse()
      return
    }

    // For video-swipe-wrapper, check if click is on empty space (not on the video inside)
    if (target.classList.contains('video-swipe-wrapper')) {
      const mediaElement = target.querySelector('video, iframe')
      if (mediaElement) {
        const rect = mediaElement.getBoundingClientRect()
        // If click is within media bounds, don't close
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          return
        }
      }
      handleCollapse()
      return
    }

    // Collapse if clicking on:
    // 1. The overlay/slide directly (not children)
    // 2. The TransformWrapper background
    if (e.target === e.currentTarget || target.classList.contains('react-transform-wrapper')) {
      handleCollapse()
    }
  }

  // Show arrows in expanded mode regardless of showArrows prop
  const shouldShowArrows = expanded || showArrows

  return (
    <div className={classNames(styles.gallery, 'gallery', className, expanded && styles.galleryExpanded)}>
      {expanded && <div className={styles.overlay} onPointerDown={handlePointerDown} onClick={handleOverlayClick} />}
      <div
        ref={containerRef}
        className={styles.main}
        style={{
          height: expanded ? undefined : disableDynamicHeight ? undefined : `${optimalHeight}px`,
        }}
      >
        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {elements.map((el, index) => (
              <div
                className={styles.emblaSlide}
                key={index}
                onPointerDown={handlePointerDown}
                onClick={handleOverlayClick}
              >
                <GalleryElementComponent
                  {...el}
                  disableZoom={disableZoom}
                  expanded={expanded}
                  onExpand={() => handleExpand(index)}
                  onNavigatePrev={index > 0 ? goToPrevious : undefined}
                  onNavigateNext={index < elements.length - 1 ? goToNext : undefined}
                />
              </div>
            ))}
          </div>
        </div>

        {shouldShowArrows && currentIndex !== 0 && (
          <Button
            onClick={goToPrevious}
            className={classNames(styles.arrow, styles.arrowPrev)}
            aria-label='Предыдущее изображение'
          >
            <ChevronLeft />
          </Button>
        )}

        {shouldShowArrows && currentIndex !== elements.length - 1 && (
          <Button
            onClick={goToNext}
            className={classNames(styles.arrow, styles.arrowNext)}
            aria-label='Следующее изображение'
          >
            <ChevronRight />
          </Button>
        )}

        {showIndicators && expanded && (
          <div className={styles.indicators}>
            {elements.map((_, index) => (
              <Button
                key={index}
                onClick={() => goToSlide(index)}
                className={classNames(styles.indicator, { [styles.indicatorActive]: index === currentIndex })}
                aria-label={`Перейти к изображению ${index + 1}`}
              >
                <span className={styles.indicatorDot}></span>
              </Button>
            ))}
          </div>
        )}

        {elements[currentIndex]?.image?.alt && (
          <div
            key={currentIndex}
            className={classNames(styles.caption, captionExpanded && styles.captionExpanded)}
            onClick={() => setCaptionExpanded(!captionExpanded)}
          >
            {elements[currentIndex]?.image?.alt}
          </div>
        )}

        {expanded && (
          <Button onClick={() => handleCollapse()} className={styles.closeButton} aria-label='Закрыть'>
            <span className='i i-close' />
          </Button>
        )}
      </div>

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
  expanded?: boolean
  onExpand?: () => void
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
}

const SWIPE_THRESHOLD = 80 // pixels to drag to trigger navigation

// Custom swipe wrapper for videos that doesn't block clicks (unlike TransformWrapper)
interface VideoSwipeWrapperProps {
  expanded?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  children: React.ReactNode
}

function VideoSwipeWrapper({ expanded, onNavigatePrev, onNavigateNext, children }: VideoSwipeWrapperProps) {
  const startXRef = useRef<number | null>(null)
  const swipeOccurredRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Capture-phase click handler to block video playback when swiping
  useEffect(() => {
    if (!expanded) return
    const el = wrapperRef.current
    if (!el) return

    const captureClick = (e: Event) => {
      if (swipeOccurredRef.current) {
        e.preventDefault()
        e.stopPropagation()
        swipeOccurredRef.current = false
      }
    }

    el.addEventListener('click', captureClick, { capture: true })
    return () => el.removeEventListener('click', captureClick, { capture: true })
  }, [expanded])

  if (!expanded) {
    // Not expanded - no swipe handling needed
    return <>{children}</>
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startXRef.current === null) return

    const deltaX = e.clientX - startXRef.current
    startXRef.current = null

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      // Mark that a swipe occurred - this will block the click event
      swipeOccurredRef.current = true
      // Clear the flag after click events have been processed
      setTimeout(() => {
        swipeOccurredRef.current = false
      }, 100)

      if (deltaX > 0 && onNavigatePrev) {
        onNavigatePrev()
      } else if (deltaX < 0 && onNavigateNext) {
        onNavigateNext()
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      className='video-swipe-wrapper'
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  )
}

function GalleryElementComponent({
  isVideo,
  image,
  htmlElement,
  element,
  disableZoom,
  expanded,
  onExpand,
  onNavigatePrev,
  onNavigateNext,
}: GalleryElementProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement, MouseEvent>): void => {
    e.stopPropagation() // Prevent overlay click handler
    if (disableZoom) return

    if (expanded) {
      // In expanded mode, zoom is handled by TransformWrapper
      return
    }

    // Trigger gallery expansion instead of separate zoom component
    onExpand?.()
  }

  // Swipe detection handler for TransformWrapper (used for both images and videos)
  const handlePanningStop = (transformRef: ReactZoomPanPinchRef) => {
    const { scale, positionX } = transformRef.state
    const wrapperEl = transformRef.instance.wrapperComponent
    const contentEl = transformRef.instance.contentComponent

    if (!wrapperEl || !contentEl) {
      transformRef.resetTransform()
      return
    }

    const wrapperWidth = wrapperEl.offsetWidth
    const contentWidth = contentEl.offsetWidth * scale

    if (scale <= 1) {
      // Not zoomed - treat any horizontal drag as swipe gesture
      if (positionX > SWIPE_THRESHOLD && onNavigatePrev) {
        onNavigatePrev()
      } else if (positionX < -SWIPE_THRESHOLD && onNavigateNext) {
        onNavigateNext()
      }
      transformRef.resetTransform()
    } else {
      // Zoomed in - check if at edge and overdragged
      const minX = wrapperWidth - contentWidth
      const maxX = 0

      if (positionX > maxX + SWIPE_THRESHOLD && onNavigatePrev) {
        onNavigatePrev()
        transformRef.resetTransform()
      } else if (positionX < minX - SWIPE_THRESHOLD && onNavigateNext) {
        onNavigateNext()
        transformRef.resetTransform()
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
  }, [ref, isVideo, htmlElement, expanded])

  if (isVideo && htmlElement) {
    return (
      <VideoSwipeWrapper expanded={expanded} onNavigatePrev={onNavigatePrev} onNavigateNext={onNavigateNext}>
        <span ref={ref} className={styles.noDragging} onClick={(e) => e.stopPropagation()} />
      </VideoSwipeWrapper>
    )
  }

  if (image) {
    // In expanded mode, wrap image with zoom-pan-pinch
    if (expanded) {
      return (
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit={true}
          centerZoomedOut={true}
          limitToBounds={false}
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: 'reset' }}
          onPanningStop={handlePanningStop}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              ref={imgRef}
              src={image.src}
              alt={image.alt}
              className={classNames(styles.image, styles.noDragging, styles.imageExpanded)}
              onClick={handleImageClick}
            />
          </TransformComponent>
        </TransformWrapper>
      )
    }

    return (
      <img
        ref={imgRef}
        src={image.src}
        alt={image.alt}
        className={classNames(styles.image, styles.noDragging, !disableZoom && 'image-scalable')}
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
