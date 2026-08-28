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
  // Only listen for Enter while our own name is actually being edited. When the input is not
  // rendered the ref is detached and react-hotkeys-hook falls back to a document-wide listener,
  // so Enter pressed in any other <input> on the page (e.g. the posts/comments filter) would
  // otherwise save the *viewed* profile's name onto the current user's account.
  const refEditName = useHotkeys<HTMLInputElement>('enter', () => handleEditNameComplete(), {
    enabled: editing && props.mine,
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
    if (!props.mine || !editing) {
      return
    }
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
