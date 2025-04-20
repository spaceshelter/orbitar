import React, { ButtonHTMLAttributes } from 'react'

import classNames from 'classnames'

import { Loader } from './Loader'

import styles from './Button.module.scss'

export const BUTTON_TYPES = {
  solid: styles.solid,
  primary: styles.primary,
  danger: styles.danger,
  ghost: styles.ghost,
  solidAccent: styles.solidAccent,
  primaryAccent: styles.primaryAccent,
  dangerAccent: styles.dangerAccent,
  ghostAccent: styles.ghostAccent,
  link: styles.link,
  minimal: styles.minimal,
} as const

export const BUTTON_SIZES = {
  small: styles.small,
  normal: styles.normal,
  big: styles.big,
} as const

export type ButtonType = keyof typeof BUTTON_TYPES
export type ButtonSize = keyof typeof BUTTON_SIZES

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Interface for Button component props
 *
 * @interface ButtonProps
 * @extends {ButtonHTMLAttributes<HTMLButtonElement>}
 */
interface ButtonProps extends BaseButtonProps {
  /** Button variant/style type */
  variant?: ButtonType

  /** Button size
   * incompatable with link variant
   * @default 'normal'
   */
  size?: ButtonSize

  /** Active state of the button
   * @default false
   */
  active?: boolean

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

  /** Content to be rendered inside the button */
  children: React.ReactNode
}

type StrictButtonProps =
  | (Omit<ButtonProps, 'variant' | 'children' | 'size'> & { variant: 'link'; children: string; size?: never })
  | (Omit<ButtonProps, 'variant' | 'size'> & {
      variant?: Exclude<ButtonType, 'link'>
      size?: ButtonSize
    })

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
export const Button: React.FC<StrictButtonProps> = ({
  variant = 'solid',
  size = 'normal',
  disabled = false,
  dynamic = false,
  loading = false,
  active = false,
  children,
  className,
  ...props
}) => {
  const isIconOnly = (): boolean => {
    const childArray = React.Children.toArray(children)

    return childArray.length === 1 && React.isValidElement(childArray[0]) && typeof childArray[0].type !== 'string'
  }

  const isLink = variant === 'link'

  const buttonClass = classNames(
    {
      [BUTTON_TYPES[variant]]: true,
      [BUTTON_SIZES[size]]: !isLink,
      [styles.disabled]: disabled || loading,
      [styles.dynamic]: dynamic,
      [styles.iconOnly]: isIconOnly(),
      [styles.active]: active,
    },
    styles.buttonComponent,
    className,
  )

  return (
    <button className={buttonClass} disabled={disabled || loading} {...props}>
      {loading ? <Loader /> : children}
    </button>
  )
}

export default Button
