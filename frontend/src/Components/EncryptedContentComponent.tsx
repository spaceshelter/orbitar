import React, { useCallback, useEffect, useState } from 'react'

import { useAPI, useAppState } from '@state/AppState'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { renderEncryptedContentHtml } from '../Utils/encryptedContentParser'
import { decryptEncryptedPayload, EncryptedPayloadEntity } from '../Utils/mailCrypto'
import ContentComponent from './ContentComponent'
import { MailboxUnlockForm } from './SecretMailbox'

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

  const titleText = payload !== null && !payload.canDecrypt ? 'Шифровка (не для вас)' : 'Шифровка'
  const bodyText = payload === null ? error || 'Загрузка...' : payload.canDecrypt ? error || '' : ''

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
    if (!payload?.payload || !appState.cryptoSession.mailboxKeyPair) {
      return
    }

    const source = await decryptEncryptedPayload(payload, appState.cryptoSession.mailboxKeyPair)
    setDecryptedHtml(renderEncryptedContentHtml(source))
    setError(null)
  }, [appState.cryptoSession.mailboxKeyPair, payload])

  useEffect(() => {
    if (
      payload?.payload &&
      appState.cryptoSession.mailboxKeyPair &&
      appState.cryptoSession.hasMailboxKey(payload.payload.wrap.publicKey, payload.payload.wrap.publicKeyAlg)
    ) {
      tryDecrypt().catch((decryptError) => {
        setError(decryptError instanceof Error ? decryptError.message : 'Не удалось расшифровать содержимое.')
      })
    }
  }, [appState.cryptoSession, payload, tryDecrypt])

  const handleUnlock = () => {
    if (!payload?.canDecrypt || !payload.payload) {
      return
    }

    if (appState.cryptoSession.hasMailboxKey(payload.payload.wrap.publicKey, payload.payload.wrap.publicKeyAlg)) {
      tryDecrypt().catch((decryptError) => {
        setError(decryptError instanceof Error ? decryptError.message : 'Не удалось расшифровать содержимое.')
      })
      return
    }

    appState.setModal(
      <MailboxUnlockForm
        publicKey={payload.payload.wrap.publicKey}
        publicKeyAlg={payload.payload.wrap.publicKeyAlg}
        onSuccess={() => {
          appState.setModal(undefined)
          tryDecrypt().catch((decryptError) => {
            setError(decryptError instanceof Error ? decryptError.message : 'Не удалось расшифровать содержимое.')
          })
        }}
        onCancel={() => appState.setModal(undefined)}
      />,
    )
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
        [styles.disabled]: payload !== null && !payload.canDecrypt,
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
