import React from 'react'

import styles from './ButtonGroup.module.scss'

/**
 * Interface for ButtonGroup component props
 *
 * @interface ButtonGroupProps
 */
type ButtonGroupProps = {
  /** Content to be rendered inside the button group */
  children: React.ReactNode
  /** Additional CSS class name
   * @default undefined
   */
  className?: string
}

/**
 * A container component for grouping buttons together
 *
 * @component
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button>First</Button>
 *   <Button>Second</Button>
 *   <Button>Third</Button>
 * </ButtonGroup>
 * ```
 */
const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className }) => {
  return <div className={`${styles.buttonGroup} ${className ?? ''}`}>{children}</div>
}

export default ButtonGroup
