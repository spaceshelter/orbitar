import React from 'react'

import Overlay from './Overlay'
import { Button, ButtonType } from './UI/Button'

import styles from './ConfirmDialog.module.scss'

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
    confirmButtonType = 'dangerAccent',
    cancelButtonType = 'solidAccent',
  } = props

  return (
    <>
      <Overlay onClick={onCancel} zIndex={9999} />
      <div className={styles.container}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.message}>{message}</div>
        <div className={styles.buttons}>
          <Button variant={confirmButtonType} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant={cancelButtonType} onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
