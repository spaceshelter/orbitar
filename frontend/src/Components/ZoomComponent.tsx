import useOnBack from '@api/use/useOnBack'
import { useAppState } from '@state/AppState'
import Button from '@ui/Button'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useHotkeys } from 'react-hotkeys-hook'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

import { ReactComponent as ChevronLeft } from '../Assets/chevron-left.svg'
import { ReactComponent as ChevronRight } from '../Assets/chevron-right.svg'
import overlayStyles from './Overlay.module.scss'
import styles from './ZoomComponent.module.scss'

const ZoomComponent = observer(function ZoomComponent() {
  const appState = useAppState()
  const onExit = () => {
    appState.setZoomedImg(null)
  }

  useHotkeys('esc', onExit)
  useOnBack(onExit)

  if (!appState.zoomedImg) return null

  const { src, width, height, goLeft, goRight } = appState.zoomedImg

  // minScale is the scale at which the image fits within the viewport
  // need to account for retina displays
  const minScale = Math.min(1, window.innerWidth / width, window.innerHeight / height)
  const defaultScale = Math.min(window.innerWidth / width, window.innerHeight / height)
  const defaultTranslateX = (window.innerWidth - width * defaultScale) / 2
  const defaultTranslateY = (window.innerHeight - height * defaultScale) / 2

  return (
    <div
      className={overlayStyles.overlay}
      onClick={(e) => {
        // check if click originated from this element
        if ((e.target as HTMLElement).classList.contains('react-transform-wrapper')) {
          onExit()
        }
      }}
    >
      <TransformWrapper
        initialScale={defaultScale}
        limitToBounds={true}
        centerZoomedOut={true}
        minScale={minScale}
        initialPositionX={defaultTranslateX}
        initialPositionY={defaultTranslateY}
      >
        {({ setTransform }) => {
          setTransform(defaultTranslateX, defaultTranslateY, defaultScale)
          return (
            <>
              {goLeft && (
                <Button
                  onClick={goLeft}
                  className={classNames(styles.arrow, styles.arrowPrev)}
                  aria-label='Предыдущее изображение'
                >
                  <ChevronLeft />
                </Button>
              )}
              {goRight && (
                <Button
                  onClick={goRight}
                  className={classNames(styles.arrow, styles.arrowNext)}
                  aria-label='Следующее изображение'
                >
                  <ChevronRight />
                </Button>
              )}
              <TransformComponent
                wrapperStyle={{
                  width: '100vw',
                  height: '100vh',
                }}
              >
                <img
                  src={src}
                  alt=''
                  style={{
                    maxWidth: 'auto !important',
                    maxHeight: 'auto !important',
                  }}
                />
              </TransformComponent>
            </>
          )
        }}
      </TransformWrapper>
      <span className={classNames('i i-close', overlayStyles.overlayCloseButton)} onClick={onExit} />
    </div>
  )
})

export default ZoomComponent
