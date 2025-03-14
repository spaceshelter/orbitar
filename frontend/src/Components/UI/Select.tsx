import React from 'react'

import styles from './Select.module.scss'

/**
 * Interface for select option
 * @interface Option
 */
interface Option {
  /** Value of the option */
  value: string
  /** Display text for the option */
  label: string
}

/**
 * Interface for Select component props
 * @interface SelectProps
 */
interface SelectProps {
  /** Optional ID attribute for the select element */
  id?: string
  /** Currently selected value */
  value: string
  /** Callback function triggered when selection changes */
  onChange: (value: string) => void
  /** Array of options to display in the dropdown */
  options: Option[]
  /** Optional placeholder text shown when no option is selected */
  placeholder?: string
  /** Whether the select is disabled
   * @default false
   */
  disabled?: boolean
  /** Additional CSS class names
   * @default ''
   */
  className?: string
}

/**
 * A customizable select dropdown component
 *
 * @component
 * @example
 * ```tsx
 * <Select
 *   options={[{ value: '1', label: 'Option 1' }]}
 *   value="1"
 *   onChange={(value) => console.log(value)}
 *   placeholder="Select an option"
 * />
 * ```
 */
const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
}) => {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${styles.select} ${className}`}
    >
      {placeholder && (
        <option value='' disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default Select
