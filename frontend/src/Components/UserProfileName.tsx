import React, { useEffect, useState } from 'react'

import Button from '@ui/Button'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'react-toastify'

import { useAPI } from '../AppState/AppState'

import { ReactComponent as EditIcon } from '../Assets/edit.svg'
import { ReactComponent as SendIcon } from '../Assets/send.svg'
import postStyles from './PostComponent.module.scss'
import nameStyles from './UserProfileName.module.scss'

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
    <div className={nameStyles.controls_align}>
      <div className={postStyles.controls}>
        {!editing && <div className={`${postStyles.control} ${nameStyles.profile_name}`}>{name}</div>}
        {editing && (
          <div className={`${postStyles.control} ${nameStyles.edit_active}`}>
            <input
              ref={refEditName}
              className={postStyles.title}
              value={name}
              onChange={handleEditName}
              placeholder={name}
              type='text'
              autoFocus
            />
          </div>
        )}

        {props.mine && !editing && (
          <div className={postStyles.control}>
            <Button variant='minimal' onClick={() => setEditing(true)}>
              <EditIcon />
            </Button>
          </div>
        )}
        {props.mine && editing && (
          <div className={postStyles.control}>
            <Button variant='minimal' onClick={handleEditNameComplete}>
              <SendIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
