import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useUserProfile } from '@api/use/useUserProfile'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import { selectElementText } from '@utils/utils'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { toast } from 'react-toastify'

import { BarmaliniAccessResult, UserGender } from '../Types/UserInfo'
import AnonymizeAccountDialog from './AnonymizeAccountDialog'
import { SecretMailKeyGeneratorForm } from './SecretMailbox'
import ThemeToggleComponent from './ThemeToggleComponent'

import styles from './UserProfileSettings.module.scss'
import { ReactComponent as AnonIcon } from '@assets/anon.svg'
import { ReactComponent as CopyIcon } from '@assets/copy.svg'
import { ReactComponent as GhostIcon } from '@assets/ghost.svg'
import { ReactComponent as LogoutIcon } from '@assets/logout.svg'
import { ReactComponent as MailboxSecureIcon } from '@assets/mailbox-secure.svg'
import { ReactComponent as TranslateIcon } from '@assets/translate.svg'
import { ReactComponent as UserIcon } from '@assets/user.svg'

type UserProfileSettingsProps = {
  onChange: () => void
  gender: UserGender
  hasApps: boolean
  barmaliniAccess?: boolean
  isBarmalini?: boolean
}

const languages = new Map([
  ['az', 'Azərbaycanca'],
  ['be', 'Беларуская'],
  ['bg', 'Български'],
  ['et', 'Eesti'],
  ['ka', 'ქართული'],
  ['kk', 'Қазақша'],
  ['ky', 'Кыргызча'],
  ['lt', 'Lietuvių'],
  ['lv', 'Latviešu'],
  ['mn', 'Монгол'],
  ['ru', 'Русский'],
  ['tg', 'Тоҷикӣ'],
  ['tk', 'Türkmençe'],
  ['uk', 'Українська'],
  ['hy', 'Հայերեն'],
  ['ky', 'қазақ'],
  ['uz', 'oʻzbek'],
])

export function getVideoAutopause(): boolean {
  return JSON.parse(localStorage.getItem('autoStopVideos') || 'false')
}

export function getAutoMuteVideos(): boolean {
  return localStorage.getItem('autoMuteVideos') === 'true'
}

export function getVideoVolume(): number {
  return parseFloat(localStorage.getItem('videoVolume') || '1')
}

export function setVideoVolume(volume: number): void {
  localStorage.setItem('videoVolume', volume.toString())
}

export function getPreferredLang(): string {
  return localStorage.getItem('preferredLang') || 'ru'
}

export function getShowInlineTranslateButton(): boolean {
  return localStorage.getItem('showInlineTranslateButton') === 'true'
}

export default function UserProfileSettings(props: UserProfileSettingsProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const api = useAPI()
  const navigate = useNavigate()
  const location = useLocation()
  const appState = useAppState()
  const { confirmAlert, userInfo } = appState

  let gender = props.gender

  const [autoStop, setAutoStop] = useState<boolean>(getVideoAutopause())
  const [autoMute, setAutoMute] = useState<boolean>(getAutoMuteVideos())
  const [preferredLang, setPreferredLang] = useState<string>(getPreferredLang())
  const [showInlineTranslateButton, setShowInlineTranslateButton] = useState<boolean>(getShowInlineTranslateButton())

  const confirmWrapper = (message: string, callback: () => void) => async (e: React.MouseEvent) => {
    e.preventDefault()

    await confirmAlert({
      message,
      onConfirm: callback,
    })
  }

  const handleLogout = confirmWrapper(
    'Вы действительно хотите выйти? Вы будете вынуждены войти в аккаунт заново.',
    () => {
      api.auth.signOut().then(() => {
        navigate(location.pathname)
      })
    },
  )

  const handleResetSessions = confirmWrapper(
    `Вы действительно хотите сбросить пароль и все сессии?
      Вы будете разлогинены на ВСЕХ устройствах, текущий пароль больше не будет работать.
      На почту использованную при регистрации (у вас же всё ещё есть доступ к ней?) придет ссылка для сброса пароля через которую вы сможете войти в аккаунт заново и установить новый пароль.`,
    () => {
      api.auth.dropPasswordAndSessions().then(() => {
        navigate(location.pathname)
      })
    },
  )

  const handleAnonymize = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!userInfo) return
    appState.setModal(
      <AnonymizeAccountDialog
        username={userInfo.username}
        onConfirm={() => {
          api.user.anonymizeAccount().then(() => {
            navigate(location.pathname)
          })
          appState.setModal(undefined)
        }}
        onCancel={() => appState.setModal(undefined)}
      />,
    )
  }

  const toggleAutoStop = () => {
    setAutoStop(!autoStop)
  }

  const toggleAutoMute = () => {
    setAutoMute(!autoMute)
  }

  const toggleShowInlineTranslateButton = () => {
    setShowInlineTranslateButton(!showInlineTranslateButton)
  }

  const changeLang = (ev: React.FormEvent<HTMLSelectElement>) => {
    const lang = ev.currentTarget.value
    setPreferredLang(lang)
  }

  const handleGenderChange = (e: React.MouseEvent) => {
    e.preventDefault()
    if (gender === undefined) {
      return
    }

    if (gender === UserGender.fluid) {
      gender = UserGender.he
    } else if (gender === UserGender.he) {
      gender = UserGender.she
    } else {
      gender = UserGender.fluid
    }
    api.userAPI
      .saveGender(gender)
      .then(() => {
        props.onChange()
      })
      .catch((error) => {
        toast.error(error?.message || 'Не удалось сохранить.')
      })
  }

  useEffect(() => {
    localStorage.setItem('autoStopVideos', JSON.stringify(autoStop))
  }, [autoStop])

  useEffect(() => {
    localStorage.setItem('autoMuteVideos', JSON.stringify(autoMute))
  }, [autoMute])

  useEffect(() => {
    localStorage.setItem('showInlineTranslateButton', JSON.stringify(showInlineTranslateButton))
  }, [showInlineTranslateButton])

  useEffect(() => {
    localStorage.setItem('preferredLang', preferredLang)
  }, [preferredLang])

  return (
    <>
      <div>
        {gender !== undefined && (
          <Button onClick={handleGenderChange}>
            <UserIcon /> Пол:{' '}
            {gender === UserGender.fluid ? 'не указан' : gender === UserGender.she ? 'женщина' : 'мужчина'}{' '}
          </Button>
        )}
        <Button onClick={toggleAutoStop}>Видео автопауза: {autoStop ? 'Вкл' : 'Выкл'}</Button>
        <Button onClick={toggleAutoMute}>Видео без звука: {autoMute ? 'Вкл' : 'Выкл'}</Button>
        {<ThemeToggleComponent dynamic={true} buttonLabel='Сменить тему' />}
      </div>
      <div className={styles.select}>
        <span className={styles.selectLabel}>Язык перевода:</span>
        <select onChange={changeLang} value={preferredLang}>
          {Array.from(languages.entries()).map(([lang, name]) => (
            <option key={lang} value={lang}>
              {name}
            </option>
          ))}
        </select>
        <Button onClick={toggleShowInlineTranslateButton}>
          Показывать <TranslateIcon />: {showInlineTranslateButton ? 'Авто' : 'Под ...'}
        </Button>
      </div>

      {/* <MailboxSettings /> */}
      {props.barmaliniAccess && <BarmaliniAccess />}

      {!props.hasApps && (
        <div>
          <Link className={`${styles.control}`} to={'/profile/apps'}>
            OAuth2 Приложения
          </Link>
        </div>
      )}

      <div>
        {!props.isBarmalini && (
          <Button variant='danger' onClick={handleResetSessions}>
            <GhostIcon /> Сброс пароля и сессий
          </Button>
        )}
        {!props.isBarmalini && (
          <Button variant='danger' onClick={handleAnonymize}>
            <AnonIcon /> Анонимизировать аккаунт
          </Button>
        )}
        <Button onClick={handleLogout}>
          <LogoutIcon /> Выйти{' '}
        </Button>
      </div>
    </>
  )
}

/**
 * Component that displays the button, when clicked,
 * the button turns into a div with the password/token (got from the server via userAPi.getBarmaliniPassword)
 * and the "copy" button.
 */
const BarmaliniAccess = observer(() => {
  const api = useAPI()
  const [access, setAccess] = React.useState<BarmaliniAccessResult | undefined>()
  const [error, setError] = React.useState<string | undefined>()
  const [expanded, setExpanded] = React.useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    if (access === undefined) {
      return
    }
    navigator.clipboard
      ?.writeText(access.password)
      ?.then(() => toast('В буфере!'))
      ?.catch()
  }

  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      'user-not-active': 'Бармалини недоступен. Надо почаще заходить на сайт ¯\\_(ツ)_/¯',
      'no-recent-comments': 'Бармалини недоступен. Напишите что-нибудь в комментариях сегодня!',
      'insufficient-karma': 'Бармалини недоступен. Нужны полные права.',
    }
    return errorMessages[errorCode] || 'Бармалини недоступен. Что-то пошло не так...'
  }

  const handleShowPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!expanded) {
      setExpanded(true)
      setError(undefined)
      api.userAPI
        .getBarmaliniAccess()
        .then((data) => {
          setAccess(data)
          setError(undefined)
        })
        .catch((error) => {
          setAccess(undefined)
          setError(getErrorMessage(error?.code || 'error'))
        })
    } else {
      setExpanded(false)
      setAccess(undefined)
      setError(undefined)
    }
  }

  return (
    <div className={styles.barmalini}>
      {expanded ? (
        <div>
          {access ? (
            <>
              <div>
                <span className={styles.label}>Логин:</span> {access.login}
              </div>
              <div>
                <span className={styles.label}>Пароль:</span>&nbsp;
                <span className={styles.password} onClick={selectElementText}>
                  {access.password}
                </span>
                &nbsp;
                <Button variant='ghost' onClick={handleCopy}>
                  <CopyIcon /> скопировать
                </Button>
              </div>
              <div>
                <span className={styles.label}>Счастливого бармаления. Пароль истекает через час.</span>
              </div>
            </>
          ) : error ? (
            <div className={styles.hint}>
              <span>{error}</span>
            </div>
          ) : (
            <div>Загрузка...</div>
          )}
        </div>
      ) : (
        <Button onClick={handleShowPassword}>Бармалинить</Button>
      )}
    </div>
  )
})

/**
 * Mailbox settings component.
 *
 * Has two states: created (public key is set) and not created (public key is not set).
 *
 * When not created, mailbox icon is greyed out and "crete" button is shown.
 * When created, mailbox icon is colored and buttons are shown:
 *  * delete
 *  * show public key
 *
 *  For mailbox creation, use SecretMailKeyGeneratorForm modal.
 *  Before deletion, use `confirmAlert`.
 */
export const MailboxSettings = observer(() => {
  const api = useAPI()
  const { userInfo, confirmAlert } = useAppState()
  const [state, refreshProfile] = useUserProfile(userInfo?.username || '')
  const publicKey = state.status === 'ready' && state.profile.publicKey
  const [creatingMailbox, setCreatingMailbox] = React.useState(false)
  const [revealPublicKey, setRevealPublicKey] = React.useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    await confirmAlert({
      message:
        'Вы действительно хотите удалить почтовый ящик? Вы больше не сможете получать новые шифровки, ' +
        'но вы сможете читать старые шифровки, адресованные вам.',
      onConfirm: () => {
        api.userAPI
          .savePublicKey('')
          .then(() => {
            refreshProfile()
          })
          .catch((error) => {
            toast.error(error?.message || 'Не удалось удалить почтовый ящик.')
          })
      },
    })
  }

  const handleShowPublicKey = (e: React.MouseEvent) => {
    e.preventDefault()
    if (publicKey) {
      // Copy to clipboard
      navigator.clipboard
        ?.writeText(publicKey)
        ?.then(() => toast('В буфере!'))
        ?.catch()
    }
  }

  const handleCreatePublicKey = (key: string) => {
    api.userAPI
      .savePublicKey(key)
      .then(() => {
        refreshProfile()
      })
      .catch((error) => {
        toast.error(error?.message || 'Не удалось создать почтовый ящик.')
      })
      .finally(() => {
        setCreatingMailbox(false)
      })
  }

  return (
    <>
      {(state.status === 'ready' && (
        <div className={styles.mailbox}>
          {(publicKey && (
            <>
              {/*mailbox exists*/}
              <div className={styles.mailboxHeader}>
                <span className={classNames('i i-mailbox-secure', { [styles.mailboxCreated]: !!publicKey })} />
                Почтовый ящик готов!
              </div>
              <div className={styles.mailboxActions}>
                <Button variant='danger' onClick={handleDelete}>
                  Удалить
                </Button>
                {!revealPublicKey && (
                  <Button variant='ghost' onClick={() => setRevealPublicKey(!revealPublicKey)}>
                    Показать публичный ключ
                  </Button>
                )}
                {revealPublicKey && (
                  <div>
                    <span className={styles.label}>Публичный ключ:</span>
                    <br />
                    <span className={styles.publicKey} onClick={handleShowPublicKey}>
                      {publicKey}
                    </span>
                  </div>
                )}
              </div>
            </>
          )) || (
            <div>
              {/*Mailbox doesn't exist*/}
              <Button
                onClick={() => {
                  setCreatingMailbox(true)
                }}
              >
                <MailboxSecureIcon /> Создать ключ для приема шифровок
              </Button>
            </div>
          )}
        </div>
      )) ||
        null}
      {creatingMailbox && (
        <div className={styles.modalWrapper}>
          <SecretMailKeyGeneratorForm onSuccess={handleCreatePublicKey} onCancel={() => setCreatingMailbox(false)} />
        </div>
      )}
    </>
  )
})
