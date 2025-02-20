import React from 'react'

import { useHotkeys } from 'react-hotkeys-hook'

import useNoScroll from '../API/use/useNoScroll' // Assuming you have an Overlay.css file for styling

import styles from './Overlay.module.scss'

let overlayCount = 0

const Overlay = (props: { onClick: () => void; zIndex?: number }) => {
  let currentOverlayIdx: number | undefined = undefined

  useNoScroll()
  useHotkeys('esc', () => {
    if (currentOverlayIdx === overlayCount) {
      props.onClick()
    }
  })

  React.useEffect(() => {
    overlayCount++
    currentOverlayIdx = overlayCount
    return () => {
      overlayCount--
    }
  }, [])

  return (
    <div
      className={styles.overlay}
      {...(props.zIndex ? { style: { zIndex: props.zIndex } } : {})}
      onClick={props.onClick}
    ></div>
  )
}

export default Overlay
