import React, { InputHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Radio.module.scss'

/**
 * Interface for Radio component props
 * @interface RadioProps
 * @extends {InputHTMLAttributes<HTMLInputElement>}
 */
interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
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
 * <Radio
 *   id="radioBtn"
 *   label="Select this option"
 *   checked={isChecked}
 *   onChange={(e) => setIsChecked(e.target.checked)}
 * />
 * ```
 */
export const Radio: React.FC<RadioProps> = ({
  label,
  checkboxSize = 'normal',
  error = false,
  className,
  id,
  ...props
}) => {
  const radioClass = classNames(
    styles.radio,
    {
      [styles.large]: checkboxSize === 'large',
      [styles.error]: error,
    },
    className,
  )

  return (
    <div className={styles.radioWrapper}>
      <input type='radio' id={id} className={radioClass} {...props} />
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
    </div>
  )
}

export default Radio
