import React, { useEffect, useState } from 'react'

import Button from '@ui/Button'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'react-toastify'

import { useAPI } from '../AppState/AppState'

import { ReactComponent as EditIcon } from '../Assets/edit.svg'
import { ReactComponent as SendIcon } from '../Assets/send.svg'
import styles from './UserProfileName.module.scss'

type UserProfileNameProps = {
  name: string
  mine: boolean
}

export default function UserProfileName(props: UserProfileNameProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(props.name)
  const api = useAPI()
  const refEditName = useHotkeys<HTMLInputElement>('enter', () => handleEditNameComplete(), {
    enableOnFormTags: ['INPUT'],
    preventDefault: true,
  })

  useEffect(() => {
    setName(props.name)
  }, [props.name])

  const handleEditName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }

  const handleEditNameComplete = async () => {
    try {
      await api.userAPI.saveName(name)
      setEditing(false)
    } catch (error: any) {
      toast.error('Не удалось сохранить.')
      throw error
    }
  }

  return (
    <div className={styles.controls}>
      {!editing && <span className={styles.name}>{name}</span>}
      {editing && (
        <input
          ref={refEditName}
          className={styles.editInput}
          value={name}
          onChange={handleEditName}
          placeholder={name}
          type='text'
          autoFocus
        />
      )}
      {props.mine && !editing && (
        <Button variant='minimal' onClick={() => setEditing(true)}>
          <EditIcon />
        </Button>
      )}
      {props.mine && editing && (
        <Button variant='minimal' onClick={handleEditNameComplete}>
          <SendIcon />
        </Button>
      )}
    </div>
  )
}
