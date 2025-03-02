import React from 'react'

import Overlay from './Overlay'

import styles from './ConfirmDialog.module.scss'

export interface ConfirmDialogProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel: () => void
  confirmButtonClassName?: string
  cancelButtonClassName?: string
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title = 'Астанавитесь!',
    message,
    confirmLabel = 'Да!',
    cancelLabel = 'Отмена',
    onConfirm,
    onCancel,
    confirmButtonClassName = '',
    cancelButtonClassName = 'cancel',
  } = props

  return (
    <>
      <Overlay onClick={onCancel} zIndex={9999} />
      <div className={styles.container}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.message}>{message}</div>
        <div className={styles.buttons}>
          <button className={confirmButtonClassName} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className={cancelButtonClassName} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </>
  )
}
