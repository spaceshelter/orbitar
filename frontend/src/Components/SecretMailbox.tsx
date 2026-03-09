import React, { useRef, useState } from 'react'

import Button from '@ui/Button'
import classNames from 'classnames'
import { useHotkeys } from 'react-hotkeys-hook'
import { useDebouncedCallback } from 'use-debounce'

import { AppState, useAppState } from '../AppState/AppState'
import { deriveMailboxKeyPair, MailboxKeyPair } from '../Utils/mailCrypto'
import Overlay from './Overlay'

import mediaFormStyles from './MediaUploader.module.scss'
import styles from './SecretMailbox.module.scss'

type SecretMailKeyGeneratorFormProps = {
  onSuccess: (keyPair: MailboxKeyPair) => void
  onCancel: () => void
}

export function SecretMailKeyGeneratorForm(props: SecretMailKeyGeneratorFormProps) {
  const password1Ref = useRef<HTMLInputElement>(null)
  const password2Ref = useRef<HTMLInputElement>(null)
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null)
  const [passwordShown, setPasswordShown] = useState(false)
  const [cut, setCut] = useState(true)
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = () => {
    if (!password1Ref.current?.value || !password2Ref.current?.value) {
      setPasswordsMatch(null)
      return
    }

    setPasswordsMatch(password1Ref.current.value === password2Ref.current.value)
  }

  const handleSubmit = async () => {
    if (passwordsMatch !== true) {
      return
    }

    try {
      setLoading(true)
      const keyPair = await deriveMailboxKeyPair(password1Ref.current?.value || '')
      props.onSuccess(keyPair)
    } finally {
      setLoading(false)
    }
  }

  useHotkeys(
    ['ctrl+enter', 'meta+enter'],
    () => {
      handleSubmit().catch()
    },
    {
      enableOnFormTags: true,
    },
  )

  const togglePassword = () => {
    setPasswordShown(!passwordShown)
  }

  const inputType = passwordShown ? 'text' : 'password'

  return (
    <>
      <Overlay onClick={props.onCancel} />
      <div className={classNames(mediaFormStyles.container, styles.container, styles.modal)}>
        <h3>
          <span className='i i-mailbox-secure'></span>
          Создать шифрованный почтовый ящик
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit().catch()
          }}
        >
          <div className={styles.info}>
            <p>
              Создайте пароль почтового ящика. Из него на этом устройстве детерминированно выводится ваш приватный ключ
              для расшифровки адресованных вам зашифрованных сообщений и будущего закрытого контента.
            </p>
          </div>
          <label>Пароль</label>
          <input
            autoFocus={true}
            type={inputType}
            placeholder='Пароль'
            id='pwd1'
            ref={password1Ref}
            onChange={handlePasswordChange}
          />
          <span
            className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)}
            onClick={togglePassword}
          ></span>

          <label>Пароль еще раз</label>
          <input
            type={inputType}
            placeholder='Пароль еще раз'
            id='pwd2'
            ref={password2Ref}
            onChange={handlePasswordChange}
          />
          <span
            className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)}
            onClick={togglePassword}
          ></span>

          <div className={styles.hint}>
            {passwordsMatch === true ? (
              <span className={classNames(mediaFormStyles.success, 'i i-thumbs-up')}> Пароли совпадают</span>
            ) : passwordsMatch === false ? (
              <span className={classNames(mediaFormStyles.error, 'i i-close')}> Пароли не совпадают</span>
            ) : (
              <span className={mediaFormStyles.warning}>Введите пароль в оба поля.</span>
            )}
          </div>

          <div className={classNames(styles.columns, styles.submit)}>
            <div className={styles.cutCover}>
              <Button
                className={styles.cutButton}
                onClick={(e) => {
                  e.preventDefault()
                  setCut(!cut)
                }}
              >
                <span className={classNames('i', 'i-info')}></span>Инфо
              </Button>
            </div>
            <div>
              <input
                type='submit'
                disabled={loading || passwordsMatch !== true}
                className={styles.buttonSend}
                value={loading ? 'Создаем...' : 'Создать'}
              />
            </div>
          </div>

          <div className={classNames(styles.hint, { [styles.collapsed]: cut })}>
            <p>
              На сервер отправляется только публичный ключ. Приватный ключ не сохраняется и каждый раз выводится из
              вашего пароля локально в браузере.
            </p>
            <p>
              Если вы смените пароль почтового ящика, изменится и пара ключей. Новый закрытый контент для вас будет
              шифроваться уже под новый ключ, а старый останется привязан к старому паролю.
            </p>
          </div>
        </form>
      </div>
    </>
  )
}

type MailboxUnlockFormProps = {
  publicKey: string
  publicKeyAlg: string
  onSuccess?: () => void
  onCancel: () => void
}

type MailboxUnlockFieldsProps = {
  publicKey: string
  publicKeyAlg: string
  onSuccess?: () => void
}

function MailboxUnlockFields(props: MailboxUnlockFieldsProps) {
  const appState = useAppState()
  const passwordRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const unlockAttemptRef = useRef(0)
  const completedRef = useRef(false)

  const handleSubmit = async (value: string, attemptId: number) => {
    const userId = appState.userInfo?.id

    if (!userId || !value || completedRef.current) {
      return
    }

    try {
      setError(null)
      await appState.cryptoSession.unlockMailbox(userId, value, props.publicKey, props.publicKeyAlg)

      if (completedRef.current) {
        return
      }

      completedRef.current = true
      setChecking(false)
      handleSubmitDebounced.cancel()
      props.onSuccess?.()
    } catch (unlockError) {
      if (
        completedRef.current ||
        appState.cryptoSession.hasMailboxKey(props.publicKey, props.publicKeyAlg) ||
        unlockAttemptRef.current !== attemptId
      ) {
        return
      }

      setChecking(false)
      setError(unlockError instanceof Error ? unlockError.message : 'Не удалось разблокировать почтовый ящик.')
    }
  }

  const handleSubmitDebounced = useDebouncedCallback((value: string, attemptId: number) => {
    handleSubmit(value, attemptId).catch()
  }, 300)

  useHotkeys(['ctrl+enter', 'meta+enter'], () => {
    const value = passwordRef.current?.value || ''
    if (!value) {
      return
    }

    handleSubmitDebounced.cancel()
    setChecking(true)
    const attemptId = unlockAttemptRef.current + 1
    unlockAttemptRef.current = attemptId
    handleSubmit(value, attemptId).catch()
  })

  React.useEffect(() => {
    if (!password || completedRef.current) {
      handleSubmitDebounced.cancel()
      setChecking(false)
      setError(null)
      return
    }

    setChecking(true)
    const attemptId = unlockAttemptRef.current + 1
    unlockAttemptRef.current = attemptId
    handleSubmitDebounced(password, attemptId)

    return () => {
      handleSubmitDebounced.cancel()
    }
  }, [handleSubmitDebounced, password])

  return (
    <>
      <input
        autoFocus={true}
        ref={passwordRef}
        className={styles.decodeInput}
        type='password'
        placeholder='Пароль от вашего почтового ящика'
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setError(null)
        }}
      />
      {(checking || appState.cryptoSession.mailboxUnlocking || error) && (
        <div className={styles.hint}>
          {(checking || appState.cryptoSession.mailboxUnlocking) && (
            <span className={classNames(styles.hintMessage, styles.hintWarning)}>
              <span className='i i-slow' />
              <span>Проверяем...</span>
            </span>
          )}
          {!checking && !appState.cryptoSession.mailboxUnlocking && error && (
            <span className={classNames(styles.hintMessage, styles.hintError)}>
              <span className='i i-close' />
              <span>{error}</span>
            </span>
          )}
        </div>
      )}
    </>
  )
}

export function MailboxUnlockForm(props: MailboxUnlockFormProps) {
  return (
    <>
      <Overlay onClick={props.onCancel} />
      <div className={classNames(mediaFormStyles.container, styles.container, styles.modal)}>
        <h3>
          <span className='i i-mailbox-secure'></span>
          Разблокировать почтовый ящик
        </h3>
        <MailboxUnlockFields
          publicKey={props.publicKey}
          publicKeyAlg={props.publicKeyAlg}
          onSuccess={props.onSuccess}
        />
      </div>
    </>
  )
}

export function requestMailboxUnlock(appState: AppState, publicKey: string, publicKeyAlg: string) {
  return new Promise<boolean>((resolve) => {
    const close = () => appState.setModal(undefined)

    appState.setModal(
      <MailboxUnlockForm
        publicKey={publicKey}
        publicKeyAlg={publicKeyAlg}
        onSuccess={() => {
          close()
          resolve(true)
        }}
        onCancel={() => {
          close()
          resolve(false)
        }}
      />,
    )
  })
}
