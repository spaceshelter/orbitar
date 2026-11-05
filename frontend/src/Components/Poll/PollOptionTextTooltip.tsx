import React, { useEffect, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import styles from './PollComponent.module.scss'

interface PollOptionTextWithTooltipProps {
  children: string
}

export const PollOptionTextWithTooltip: React.FC<PollOptionTextWithTooltipProps> = ({ children }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [isTextTruncated, setIsTextTruncated] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  // Check if text is truncated
  useEffect(() => {
    const checkIfTruncated = () => {
      if (textRef.current) {
        const element = textRef.current
        setIsTextTruncated(element.scrollWidth > element.clientWidth)
      }
    }

    // Initial check
    checkIfTruncated()

    // Check on window resize
    window.addEventListener('resize', checkIfTruncated)

    return () => {
      window.removeEventListener('resize', checkIfTruncated)
    }
  }, [children])

  useEffect(() => {
    if (!showTooltip || !tooltipRef.current || !triggerRef.current) {
      return
    }

    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    const rect = trigger.getBoundingClientRect()

    tooltip.style.top = `${rect.bottom + window.scrollY}px`
    tooltip.style.left = `${Math.max(20, rect.left - 150)}px` // Center tooltip roughly

    const clickHandler = (e: MouseEvent) => {
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return // Don't close if clicked inside tooltip
      }

      e.stopPropagation()
      setShowTooltip(false)
    }

    document.addEventListener('mousedown', clickHandler)
    return () => {
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [showTooltip])

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    setShowTooltip(!showTooltip)
  }

  return (
    <>
      <span ref={textRef} title={children}>
        {children}
      </span>

      {isTextTruncated && (
        <span ref={triggerRef} className={styles.ellipsis} onClick={handleClick}>
          ...
        </span>
      )}

      {showTooltip &&
        createPortal(
          <div ref={tooltipRef} className={styles.fullTextTooltip}>
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
