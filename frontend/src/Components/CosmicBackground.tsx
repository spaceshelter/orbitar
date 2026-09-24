import React, { useEffect, useRef } from 'react'

import { startCosmicScene } from './cosmicScene'

import styles from './CosmicBackground.module.scss'

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    return startCosmicScene(canvasRef.current)
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden='true' />
      <div className={styles.vignette} aria-hidden='true' />
    </>
  )
}
