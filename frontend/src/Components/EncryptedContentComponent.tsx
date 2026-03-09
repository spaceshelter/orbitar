import React, { useCallback, useEffect, useState } from 'react'

import { useAPI, useAppState } from '@state/AppState'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { renderEncryptedContentHtml } from '../Utils/encryptedContentParser'
import { getEncryptedPayloadSource } from '../Utils/encryptedPayloadSource'
import { EncryptedPayloadEntity } from '../Utils/mailCrypto'
import ContentComponent from './ContentComponent'

import styles from './EncryptedContentComponent.module.scss'

type EncryptedContentComponentProps = {
  encryptedPayloadId: number
  kind: 'post' | 'comment'
  className?: string
  autoCut?: number
  lowRating?: boolean
}

const EncryptedContentComponent = observer((props: EncryptedContentComponentProps) => {
  const api = useAPI()
  const appState = useAppState()
  const [payload, setPayload] = useState<EncryptedPayloadEntity | null>(null)
  const [decryptedHtml, setDecryptedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mailboxKeyPair = appState.cryptoSession.mailboxKeyPair
  const mailboxMatchesPayload =
    !!payload?.payload &&
    !!mailboxKeyPair &&
    appState.cryptoSession.hasMailboxKey(payload.payload.wrap.publicKey, payload.payload.wrap.publicKeyAlg)

  const titleText =
    payload === null
      ? error
        ? 'Шифровка'
        : 'Шифровка (загрузка)'
      : !payload.canDecrypt
        ? 'Шифровка (не для вас)'
        : 'Шифровка'
  const bodyText = payload === null ? error || '' : payload.canDecrypt ? error || '' : ''

  useEffect(() => {
    setDecryptedHtml(null)
    setError(null)

    api.encryptedPayload
      .getEncryptedPayloadCached(props.encryptedPayloadId)
      .then((result) => {
        setPayload(result)
      })
      .catch(() => {
        setError('Не удалось загрузить зашифрованное содержимое.')
      })
  }, [api.encryptedPayload, props.encryptedPayloadId])

  const tryDecrypt = useCallback(async () => {
    if (!payload?.payload) {
      return
    }

    const source = await getEncryptedPayloadSource(appState, payload)

    if (source === undefined) {
      return
    }

    setDecryptedHtml(renderEncryptedContentHtml(source))
    setError(null)
  }, [appState, payload])

  useEffect(() => {
    if (decryptedHtml === null && mailboxMatchesPayload) {
      tryDecrypt().catch((decryptError) => {
        setError(decryptError instanceof Error ? decryptError.message : 'Не удалось расшифровать содержимое.')
      })
    }
  }, [decryptedHtml, mailboxMatchesPayload, tryDecrypt])

  const handleUnlock = () => {
    if (!payload?.canDecrypt || !payload.payload) {
      return
    }

    tryDecrypt().catch((decryptError) => {
      setError(decryptError instanceof Error ? decryptError.message : 'Не удалось расшифровать содержимое.')
    })
  }

  if (decryptedHtml !== null) {
    return (
      <ContentComponent
        className={props.className}
        content={decryptedHtml}
        autoCut={props.autoCut}
        lowRating={props.lowRating}
      />
    )
  }

  return (
    <div
      className={classNames(styles.locked, props.className, {
        [styles.canDecrypt]: !!payload?.canDecrypt,
        [styles.disabled]: payload === null || (payload !== null && !payload.canDecrypt),
        [styles.error]: !!error,
      })}
      onClick={payload?.canDecrypt ? handleUnlock : undefined}
    >
      <div className={styles.header}>
        <span className='i i-mail-secure' />
        <span>{titleText}</span>
      </div>
      {bodyText && <div className={styles.body}>{bodyText}</div>}
    </div>
  )
})

export default EncryptedContentComponent
