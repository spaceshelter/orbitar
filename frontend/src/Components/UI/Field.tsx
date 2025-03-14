import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

import classNames from 'classnames'

import styles from './Field.module.scss'

type InputProps = InputHTMLAttributes<HTMLInputElement>
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Интерфейс пропсов компонента Field
 * @interface
 * @property {string} [label] - Текст метки поля
 * @property {string} [error] - Текст сообщения об ошибке
 * @property {'input' | 'textarea'} [variant='input'] - Вариант отображения поля (обычное поле ввода или текстовая область)
 * @property {string} [className] - Дополнительные CSS классы
 */
export interface FieldProps extends Omit<InputProps & TextAreaProps, 'className'> {
  label?: string
  error?: string
  variant?: 'input' | 'textarea'
  className?: string
}

/**
 * Универсальный компонент поля ввода, поддерживающий как обычные поля ввода, так и текстовые области.
 *
 * @component
 * @example
 * // Обычное поле ввода
 * <Field
 *   label="Имя"
 *   placeholder="Введите ваше имя"
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 * />
 *
 * @example
 * // Текстовая область
 * <Field
 *   variant="textarea"
 *   label="Описание"
 *   placeholder="Введите описание"
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 * />
 *
 * @example
 * // Поле с ошибкой
 * <Field
 *   label="Email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error="Неверный формат email"
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
