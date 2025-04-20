import React, { InputHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Checkbox.module.scss'

/**
 * Interface for Checkbox component props
 * @interface CheckboxProps
 * @extends {InputHTMLAttributes<HTMLInputElement>}
 */
interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text to display next to the checkbox
   * @optional
   */
  label?: string
  /** Size variant of the checkbox
   * @default 'normal'
   */
  checkboxSize?: 'normal' | 'large'
  /** Error state of the checkbox
   * @default false
   */
  error?: boolean
  /** ID for the checkbox input
   * @required
   */
  id: string
}

/**
 * A customizable checkbox component that supports different sizes and states
 *
 * @component
 * @example
 * ```tsx
 * <Checkbox
 *   id="allowRescind"
 *   label="Allow vote rescinding"
 *   checked={isChecked}
 *   onChange={(e) => setIsChecked(e.target.checked)}
 * />
 * ```
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checkboxSize = 'normal',
  error = false,
  className,
  id,
  ...props
}) => {
  const checkboxClass = classNames(
    styles.checkbox,
    {
      [styles.large]: checkboxSize === 'large',
      [styles.error]: error,
    },
    className,
  )

  return (
    <div className={styles.checkboxWrapper}>
      <input type='checkbox' id={id} className={checkboxClass} {...props} />
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
    </div>
  )
}

export default Checkbox
