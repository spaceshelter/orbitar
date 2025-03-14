import React, { ButtonHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from '../Buttons.module.scss'

/**
 * Interface for Button component props
 * @interface ButtonProps
 * @extends {ButtonHTMLAttributes<HTMLButtonElement>}
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant/style type
   * @default 'settings'
   */
  variant?: 'settings' | 'logout' | 'link' | 'positive'
  /** Button size
   * @default 'normal'
   */
  size?: 'normal' | 'bigger'
  /** Disabled state of the button
   * @default false
   */
  disabled?: boolean
  /** Content to be rendered inside the button */
  children: React.ReactNode
}

/**
 * A customizable button component that supports different variants and sizes
 *
 * @component
 * @example
 * ```tsx
 * <Button variant="positive" size="bigger" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'settings',
  size = 'normal',
  disabled = false,
  children,
  className,
  ...props
}) => {
  const buttonClass = classNames(
    {
      [styles.settingsButton]: variant === 'settings',
      [styles.logoutButton]: variant === 'logout',
      [styles.linkButton]: variant === 'link',
      [styles.positiveButton]: variant === 'positive',
      [styles.bigger]: size === 'bigger',
      [styles.disabled]: disabled,
    },
    className,
  )

  return (
    <button className={buttonClass} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

export default Button
