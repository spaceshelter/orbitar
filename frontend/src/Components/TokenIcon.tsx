import React from 'react'

import { ReactComponent as TokenIconSVG } from '../Assets/token.svg'
import styles from './TokenIcon.module.scss'

interface TokenIconProps {
  className?: string
  style?: React.CSSProperties
  size?: number
}

export const TokenIcon: React.FC<TokenIconProps> = ({ className, style, size = 16 }) => {
  const iconStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    ...style,
  }

  const cssClasses = `${styles.tokenIcon} ${className || ''}`

  return <TokenIconSVG className={cssClasses} style={iconStyle} />
}

export default TokenIcon
