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

/** Options under a heading, rendered as an optgroup */
interface OptionGroup {
  label: string
  options: Option[]
}

/**
 * Interface for Select component props
 * @interface SelectProps
 */
interface SelectProps {
  /** Optional ID attribute for the select element */
  id?: string
  /** Accessible name, for a select without a visible label */
  'aria-label'?: string
  /** Currently selected value */
  value: string
  /** Callback function triggered when selection changes */
  onChange: (value: string) => void
  /** Options to display in the dropdown, alone or in groups */
  options: Array<Option | OptionGroup>
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

const renderOption = (option: Option) => (
  <option key={option.value} value={option.value}>
    {option.label}
  </option>
)

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
  'aria-label': ariaLabel,
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
      aria-label={ariaLabel}
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
      {options.map((item) =>
        'options' in item ? (
          <optgroup key={item.label} label={item.label}>
            {item.options.map(renderOption)}
          </optgroup>
        ) : (
          renderOption(item)
        ),
      )}
    </select>
  )
}

export default Select
