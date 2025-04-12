import React, { ButtonHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Button.module.scss'

/**
 * Interface for Button component props
 * @interface ButtonProps
 * @extends {ButtonHTMLAttributes<HTMLButtonElement>}
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant/style type
   * @default 'default'
   */
  variant: 'default' | 'primary' | 'link' | 'danger' | 'ghost' | 'positive'
  /** Button size
   * @default 'normal'
   */
  size?: 'normal' | 'condensed'
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
  variant = 'default',
  size = 'normal',
  disabled = false,
  children,
  className,
  ...props
}) => {
  const buttonClass = classNames(
    {
      [styles.default]: variant === 'default',
      [styles.link]: variant === 'link',
      [styles.danger]: variant === 'danger',
      [styles.ghost]: variant === 'ghost',
      [styles.positive]: variant === 'positive',
      [styles.primary]: variant === 'primary',
      [styles.condensed]: size === 'condensed',
      [styles.disabled]: disabled,
    },
    styles.buttonComponent,
    className,
  )

  return (
    <button className={buttonClass} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

export default Button
