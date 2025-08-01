import React, { useState } from 'react'

import { toast } from 'react-toastify'

import Overlay from './Overlay'
import { Button } from './UI/Button'
import { Field } from './UI/Field'

import styles from './AnonymizeAccountDialog.module.scss'

type Props = {
  username: string
  onConfirm: () => void
  onCancel: () => void
}

export default function AnonymizeAccountDialog({ username, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState('')
  const reversed = username.split('').reverse().join('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value === reversed) {
      onConfirm()
    } else {
      toast.error('Неверное подтверждение')
    }
  }

  return (
    <>
      <Overlay onClick={onCancel} zIndex={9999} />
      <div className={styles.container} style={{ zIndex: 10000 }}>
        <h2 className={styles.title}>Анонимизировать аккаунт?</h2>
        <p className={styles.message}>Это действие необратимо. Введите имя пользователя наоборот для подтверждения.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Field autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          <div className={styles.buttons}>
            <Button variant='danger' type='submit'>
              Анонимизировать
            </Button>
            <Button onClick={onCancel}>Отмена</Button>
          </div>
        </form>
      </div>
    </>
  )
}
