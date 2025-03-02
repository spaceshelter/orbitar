import React from 'react'

import Overlay from './Overlay'

import styles from './ConfirmDialog.module.scss'

export const BUTTON_TYPES = {
  primary: styles.primaryButton,
  secondary: styles.secondaryButton,
  danger: styles.dangerButton,
  ghost: styles.ghostButton,
} as const

export type ButtonType = keyof typeof BUTTON_TYPES

export interface ConfirmDialogProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel: () => void
  confirmButtonType?: ButtonType
  cancelButtonType?: ButtonType
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title = 'Астанавитесь!',
    message,
    confirmLabel = 'Да!',
    cancelLabel = 'Отмена',
    onConfirm,
    onCancel,
    confirmButtonType = 'danger',
    cancelButtonType = 'secondary',
  } = props

  return (
    <>
      <Overlay onClick={onCancel} zIndex={9999} />
      <div className={styles.container}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.message}>{message}</div>
        <div className={styles.buttons}>
          <button className={BUTTON_TYPES[confirmButtonType]} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className={BUTTON_TYPES[cancelButtonType]} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </>
  )
}
