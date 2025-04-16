import React, { ButtonHTMLAttributes } from 'react'

import classNames from 'classnames'

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

type StrictButtonProps =
  | (Omit<ButtonProps, 'variant' | 'children'> & { variant: 'link'; children: string })
  | (Omit<ButtonProps, 'variant'> & { variant?: Exclude<ButtonType, 'link'> })

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
  rotating = false,
  loading = false,
  children,
  className,
  ...props
}) => {
  const isIconOnly = (): boolean => {
    const childArray = React.Children.toArray(children)

    return childArray.length === 1 && React.isValidElement(childArray[0]) && typeof childArray[0].type !== 'string'
  }

  const buttonClass = classNames(
    {
      [BUTTON_TYPES[variant]]: true,
      [BUTTON_SIZES[size]]: true,
      [styles.disabled]: disabled,
      [styles.dynamic]: dynamic,
      [styles.rotating]: rotating,
      [styles.iconOnly]: isIconOnly(),
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
