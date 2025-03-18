import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Field.module.scss'

type InputProps = InputHTMLAttributes<HTMLInputElement>
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * interface for props of Field component
 * @interface
 * @property {string} [label] - text of label
 * @property {string} [error] - text of error message
 * @property {'input' | 'textarea'} [variant='input'] - variant of field (input or textarea)
 * @property {string} [className] - additional css classes
 */
export interface FieldProps extends Omit<InputProps & TextAreaProps, 'className'> {
  label?: string
  error?: string
  variant?: 'input' | 'textarea'
  className?: string
}

/**
 * Universal component of input field, supporting both input and textarea.
 *
 * @component
 * @example
 * // Regular input field
 * <Field
 *   label="Name"
 *   placeholder="Enter your name"
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 * />
 *
 * @example
 * // Textarea
 * <Field
 *   variant="textarea"
 *   label="Description"
 *   placeholder="Describe yourself"
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 * />
 *
 * @example
 * // Field with error
 * <Field
 *   label="Email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error="Invalid email format"
 * />
 */
export const Field: React.FC<FieldProps> = ({ label, error, variant = 'input', className, ...props }) => {
  const fieldClassName = classNames(
    styles.field,
    {
      [styles.error]: error,
    },
    className,
  )

  const renderField = () => {
    if (variant === 'textarea') {
      return <textarea className={styles.textarea} {...(props as TextAreaProps)} />
    }

    return <input className={styles.input} {...(props as InputProps)} />
  }

  return (
    <div className={fieldClassName}>
      {label && <label className={styles.label}>{label}</label>}
      {renderField()}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  )
}
