import useOnBack from '@api/use/useOnBack'
import { useAppState } from '@state/AppState'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useHotkeys } from 'react-hotkeys-hook'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

import overlayStyles from './Overlay.module.scss'

const ZoomComponent = observer(function ZoomComponent() {
  const appState = useAppState()
  const onExit = () => {
    appState.setZoomedImg(null)
  }

  const isZoomed = !!appState.zoomedImg

  useHotkeys('esc', onExit, { enabled: isZoomed })
  useOnBack(onExit, isZoomed)

  if (!appState.zoomedImg) return null

  const { src, width, height } = appState.zoomedImg

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
        key={src}
        initialScale={defaultScale}
        limitToBounds={true}
        centerZoomedOut={true}
        minScale={minScale}
        initialPositionX={defaultTranslateX}
        initialPositionY={defaultTranslateY}
      >
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
      </TransformWrapper>
      <span className={classNames('i i-close', overlayStyles.overlayCloseButton)} onClick={onExit} />
    </div>
  )
})

export default ZoomComponent
