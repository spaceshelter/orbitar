import React, { useEffect, useState } from 'react'

import { MailEntity } from '@api/types/Mail'
import { useAPI } from '@state/AppState'
import classNames from 'classnames'

type MailComponentProps = {
  mailId: number
  title?: string
}

function MailLabel(props: { mail: MailEntity; title: string }) {
  if (props.mail.role === 'from') {
    return (
      <>
        <span>{props.title}</span>
        <span>{' для '}</span>
        <span className='mention'>{props.mail.toUsername}</span>
      </>
    )
  }

  if (props.mail.role === 'to') {
    return (
      <>
        <span>{props.title}</span>
        <span>{' от '}</span>
        <span className='mention'>{props.mail.fromUsername}</span>
      </>
    )
  }

  return (
    <>
      <span>{props.title}</span>
      <span>{' для '}</span>
      <span className='mention'>{props.mail.toUsername}</span>
    </>
  )
}

export const MailComponent: React.FC<MailComponentProps> = ({ mailId, title = 'Шифровка' }) => {
  const api = useAPI()
  const [mail, setMail] = useState<MailEntity | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    api.mail
      .getMailCached(mailId)
      .then((mailData) => {
        if (!active) {
          return
        }
        setMail(mailData)
        setError(false)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setMail(null)
        setError(true)
      })

    return () => {
      active = false
    }
  }, [api.mail, mailId])

  return (
    <div
      className={classNames('i', 'i-mail-secure', 'secret-mail', {
        'secret-mail-disabled': !!mail && !mail.canDecrypt,
        'secret-mail-error': error,
      })}
    >
      {mail ? <MailLabel mail={mail} title={title} /> : <span>{title}</span>}
    </div>
  )
}
