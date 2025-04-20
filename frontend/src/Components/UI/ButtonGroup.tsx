import React from 'react'

import styles from './ButtonGroup.module.scss'

/**
 * Enum for button group spacing options
 */
export enum ButtonGroupSpacing {
  COMPACT = 'compact',
  DEFAULT = 'default',
  SPACIOUS = 'spacious',
}

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
  /** Spacing between buttons
   * @default ButtonGroupSpacing.DEFAULT
   */
  spacing?: ButtonGroupSpacing
}

/**
 * A container component for grouping buttons together
 *
 * @component
 * @example
 * ```tsx
 * <ButtonGroup spacing={ButtonGroupSpacing.DEFAULT}>
 *   <Button>First</Button>
 *   <Button>Second</Button>
 *   <Button>Third</Button>
 * </ButtonGroup>
 * ```
 *
 * <ButtonGroup spacing={ButtonGroupSpacing.SPACIOUS}>
 *   <Button>First</Button>
 *   <Button>Second</Button>
 *   <Button>Third</Button>
 * </ButtonGroup>
 */
const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className, spacing = ButtonGroupSpacing.DEFAULT }) => {
  return <div className={`${styles.buttonGroup} ${styles[spacing]} ${className ?? ''}`}>{children}</div>
}

export default ButtonGroup
