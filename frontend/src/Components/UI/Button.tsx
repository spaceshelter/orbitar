import React, { ButtonHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Button.module.scss'

export const BUTTON_TYPES = {
  solid: styles.solid,
  primary: styles.primary,
  danger: styles.danger,
  ghost: styles.ghost,
  link: styles.link,
} as const

export const BUTTON_SIZES = {
  small: styles.small,
  normal: styles.normal,
  big: styles.big,
} as const

export type ButtonType = keyof typeof BUTTON_TYPES
export type ButtonSize = keyof typeof BUTTON_SIZES

/**
 * Interface for Button component props
 * @interface ButtonProps
 * @extends {ButtonHTMLAttributes<HTMLButtonElement>}
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant/style type
   * @default 'solid'
   */
  variant?: ButtonType
  /** Button size
   * @default 'normal'
   */
  size?: ButtonSize
  /** Disabled state of the button
   * @default false
   */
  disabled?: boolean
  /** Loading state of the button
   * @default false
   */
  loading?: boolean
  /** Dynamic state for theme buttons
   * @default false
   */
  dynamic?: boolean
  /** Rotating state for refresh buttons
   * @default false
   */
  rotating?: boolean
  /** Content to be rendered inside the button */
  children: React.ReactNode
}

/**
 * A customizable button component that supports different variants and sizes
 *
 * @component
 * @example
 * ```tsx
 * <Button variant="primary" size="big" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'solid',
  size = 'normal',
  disabled = false,
  dynamic = false,
  rotating = false,
  loading = false,
  children,
  className,
  ...props
}) => {
  const buttonClass = classNames(
    {
      [BUTTON_TYPES[variant]]: true,
      [BUTTON_SIZES[size]]: true,
      [styles.disabled]: disabled,
      [styles.dynamic]: dynamic,
      [styles.rotating]: rotating,
    },
    styles.buttonComponent,
    className,
  )

  return (
    <button className={buttonClass} disabled={disabled} {...props}>
      {loading && <span className={styles.loading} />}
      {children}
    </button>
  )
}

export default Button
