import React, { useEffect, useRef, useState } from 'react'

import classNames from 'classnames'
import { useHotkeys } from 'react-hotkeys-hook'
import OutsideClickHandler from 'react-outside-click-handler'
import TextareaAutosize from 'react-textarea-autosize'
import { toast } from 'react-toastify'
import { useDebouncedCallback } from 'use-debounce'

import useFocus from '../API/use/useFocus'
import { useAPI, useAppState } from '../AppState/AppState'
import {
  decryptMailEnvelope,
  decryptMailEnvelopeWithCachedKey,
  deriveMailboxKeyPair,
  encryptMailEnvelope,
  MAIL_VERSION,
  MAILBOX_KEY_ALG,
  MailboxKeyPair,
} from '../Utils/mailCrypto'
import Overlay from './Overlay'

import createCommentStyles from './CreateCommentComponent.module.scss'
import mediaFormStyles from './MediaUploader.module.scss'
import styles from './SecretMailbox.module.scss'

export function SecretMailEncoderForm(props: {
  openKey: string
  keyAlg?: string
  forUsername?: string
  mailboxTitle?: string
  onClose: (result?: string) => void
}) {
  const [sourceText, setSourceText] = useState('')
  const [loading, setLoading] = useState(false)
  const testAreaRef = useFocus<HTMLTextAreaElement>()
  const currentUser = useAppState().userInfo
  const [ownMailboxKey, setOwnMailboxKey] = useState<{ publicKey?: string; publicKeyAlg?: string } | null>(null)

  const api = useAPI()

  useEffect(() => {
    if (!currentUser?.username) {
      setOwnMailboxKey(null)
      return
    }

    let active = true

    api.postAPI
      .getPublicKeyByUsername(currentUser.username)
      .then((key) => {
        if (!active) {
          return
        }
        setOwnMailboxKey(key || null)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setOwnMailboxKey(null)
      })

    return () => {
      active = false
    }
  }, [api.postAPI, currentUser?.username])

  const handleSubmit = async () => {
    const plaintext = sourceText.trim()
    if (!plaintext) {
      return
    }
    if (!currentUser?.id) {
      toast.error('Нужно войти в аккаунт, чтобы отправлять шифровки.')
      return
    }
    if (props.keyAlg && props.keyAlg !== MAILBOX_KEY_ALG) {
      toast.error('Почтовый ящик адресата использует неподдерживаемый формат ключа.')
      return
    }

    try {
      setLoading(true)
      const toPayload = await encryptMailEnvelope(plaintext, props.openKey)
      const fromPayload =
        ownMailboxKey?.publicKey && ownMailboxKey.publicKeyAlg === MAILBOX_KEY_ALG
          ? await encryptMailEnvelope(plaintext, ownMailboxKey.publicKey)
          : undefined

      const result = await api.mailAPI.createMail({
        toPublicKey: props.openKey,
        v: MAIL_VERSION,
        toPayload,
        fromPayload,
      })

      props.onClose(`<mail id="${result.id}">${props.mailboxTitle || 'Шифровка'}</mail>`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать шифровку.')
    } finally {
      setLoading(false)
    }
  }

  useHotkeys(
    ['ctrl+enter', 'meta+enter'],
    () => {
      handleSubmit().then().catch()
    },
    {
      enableOnFormTags: true,
    },
  )

  return (
    <>
      <Overlay
        onClick={() => {
          props.onClose()
        }}
      />
      <div className={classNames(mediaFormStyles.container, styles.container, styles.modal)}>
        <h3 className={classNames(styles.shortTitle)}>
          <span className='i i-mail-secure' />
          <span>{`${props.mailboxTitle || 'Написать шифровку'}`}</span>
        </h3>
        {ownMailboxKey && (!ownMailboxKey.publicKey || ownMailboxKey.publicKeyAlg !== MAILBOX_KEY_ALG) && (
          <div className={styles.info}>
            <p>
              Вы сможете отправить шифровку, но не сможете открыть свою копию позже, пока не создадите новый почтовый
              ящик v2 в настройках профиля.
            </p>
          </div>
        )}
        <div className={classNames(createCommentStyles.editor, createCommentStyles.answer)}>
          <TextareaAutosize
            placeholder='Текст шифровки'
            ref={testAreaRef}
            minRows={3}
            maxRows={25}
            maxLength={20000}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
        </div>
        <div className={createCommentStyles.final}>
          {/* eslint-disable-next-line react/forbid-elements */}
          <button
            className={classNames(styles.copyButton, mediaFormStyles.choose)}
            disabled={loading || !sourceText.trim()}
            onClick={() => handleSubmit().then().catch()}
          >
            {loading ? 'Создаем...' : 'Готово'}
          </button>
        </div>
      </div>
    </>
  )
}

export function SecretMailDecoderForm(props: { payload: string; title: string; onClose: (result?: string) => void }) {
  const { onClose, payload, title } = props
  const currentUser = useAppState().userInfo
  const passwordRef = useFocus<HTMLInputElement>()
  const [wrongPassword, setWrongPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentUser?.id) {
      return
    }

    let active = true
    setLoading(true)

    decryptMailEnvelopeWithCachedKey(payload, currentUser.id)
      .then((decoded) => {
        if (!active || !decoded) {
          return
        }
        onClose(decoded)
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [currentUser?.id, onClose, payload])

  const handleDecode = useDebouncedCallback(async (password: string) => {
    if (!currentUser?.id) {
      return
    }

    setLoading(true)
    try {
      const decoded = await decryptMailEnvelope(payload, password, currentUser.id)
      onClose(decoded)
      setWrongPassword(false)
    } catch (error) {
      setWrongPassword(!!password.length)
    } finally {
      setLoading(false)
    }
  }, 300)

  return (
    <OutsideClickHandler
      onOutsideClick={() => {
        props.onClose()
      }}
    >
      <div className={classNames(styles.container)}>
        <h3>
          <span className={classNames('i', 'i-mail-secure')} />
          <span>{title}</span>
        </h3>
        <input
          autoFocus={true}
          ref={passwordRef}
          className={styles.decodeInput}
          type='password'
          placeholder='Пароль от почтового ящика'
          onChange={(e) => {
            handleDecode(e.target.value)
          }}
        />
        {(loading || wrongPassword) && (
          <div className={styles.hint}>
            {loading && <span className={classNames(mediaFormStyles.warning, 'i i-slow')}>Проверяем...</span>}
            {!loading && <span className={classNames(mediaFormStyles.error, 'i i-close')}>Пароль не подходит.</span>}
          </div>
        )}
      </div>
    </OutsideClickHandler>
  )
}

type SecretMailKeyGeneratorFormProps = {
  onSuccess: (keyPair: MailboxKeyPair) => void
  onCancel: () => void
}

export function SecretMailKeyGeneratorForm(props: SecretMailKeyGeneratorFormProps) {
  const currentUser = useAppState().userInfo
  const password1Ref = useRef<HTMLInputElement>(null)
  const password2Ref = useRef<HTMLInputElement>(null)
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null)
  const [passwordShown, setPasswordShown] = useState(false)
  const [cut, setCut] = useState(true)
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = () => {
    if (!password1Ref?.current?.value || !password2Ref?.current?.value) {
      setPasswordsMatch(null)
      return
    }
    setPasswordsMatch(password1Ref.current.value === password2Ref.current.value)
  }

  const handleSubmit = async () => {
    if (passwordsMatch !== true || !currentUser?.id) {
      return
    }

    try {
      setLoading(true)
      const passwd = password1Ref?.current?.value || ''
      const keyPair = await deriveMailboxKeyPair(passwd, currentUser.id)
      props.onSuccess(keyPair)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать почтовый ящик.')
    } finally {
      setLoading(false)
    }
  }

  useHotkeys(
    ['ctrl+enter', 'meta+enter'],
    () => {
      handleSubmit().then().catch()
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
            handleSubmit().then().catch()
          }}
        >
          <div className={styles.info}>
            <p>
              Создайте отдельный пароль для шифрованного почтового ящика. Из него детерминированно выводится ваш
              приватный ключ, а публичный ключ сохраняется на сервере и используется другими клиентами для шифрования
              адресованных вам сообщений.
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
              {/* eslint-disable-next-line react/forbid-elements */}
              <button
                className={classNames('button', styles.cutButton)}
                type='button'
                onClick={(e) => {
                  e.preventDefault()
                  setCut(!cut)
                }}
              >
                <span className={classNames('i', 'i-info')}></span>Инфо
              </button>
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
              Публичный ключ можно публиковать и вставлять в теги <code>{'<mailbox secret="...">'}</code>. Приватный
              ключ нигде не сохраняется и каждый раз воспроизводится из вашего пароля на этом устройстве.
            </p>
            <p>
              Если вы поменяете пароль почтового ящика, то получите новый набор ключей. Новые сообщения будут
              шифроваться на новый ключ, а старые сообщения можно будет прочитать только старым паролем.
            </p>
          </div>
        </form>
      </div>
    </>
  )
}

export { MAILBOX_KEY_ALG, MAIL_VERSION }
