import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { toast } from 'react-toastify'

import { useUserProfile } from '../API/use/useUserProfile'
import { useAPI, useAppState } from '../AppState/AppState'
import { BarmaliniAccessResult, UserGender } from '../Types/UserInfo'
import { selectElementText } from '../Utils/utils'
import { SecretMailKeyGeneratorForm } from './SecretMailbox'
import ThemeToggleComponent from './ThemeToggleComponent'

import { ReactComponent as LogoutIcon } from '../Assets/logout.svg'
import { ReactComponent as TranslateIcon } from '../Assets/translate.svg'
import { ReactComponent as UserIcon } from '../Assets/user.svg'
import buttonStyles from '../Components/Buttons.module.scss'
import styles from './UserProfileSettings.module.scss'

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

export function getLegacyZoom(): boolean {
  return localStorage.getItem('legacyZoom') === 'true'
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
  const { confirmAlert } = useAppState()

  let gender = props.gender

  const [autoStop, setAutoStop] = useState<boolean>(getVideoAutopause())
  const [legacyZoom, setLegacyZoom] = useState<boolean>(getLegacyZoom())
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

  const toggleAutoStop = () => {
    setAutoStop(!autoStop)
  }

  const toggleLegacyZoom = () => {
    setLegacyZoom(!legacyZoom)
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
    localStorage.setItem('legacyZoom', JSON.stringify(legacyZoom))
  }, [legacyZoom])

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
          <button className={buttonStyles.logoutButton} onClick={handleGenderChange}>
            <UserIcon /> Пол:{' '}
            {gender === UserGender.fluid ? 'не указан' : gender === UserGender.she ? 'женщина' : 'мужчина'}{' '}
          </button>
        )}
        <button className={buttonStyles.settingsButton} onClick={toggleAutoStop}>
          Видео автопауза: {autoStop ? 'Вкл' : 'Выкл'}
        </button>
        <button className={buttonStyles.settingsButton} onClick={toggleLegacyZoom}>
          Легаси зум: {legacyZoom ? 'Вкл' : 'Выкл'}
        </button>
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
        <button className={buttonStyles.settingsButton} onClick={toggleShowInlineTranslateButton}>
          Показывать <TranslateIcon />: {showInlineTranslateButton ? 'Авто' : 'Под ...'}
        </button>
      </div>

      {/*<MailboxSettings/>*/}
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
          <button
            className={classNames(buttonStyles.settingsButton, styles.dropSessions)}
            onClick={handleResetSessions}
          >
            <span className={classNames('i i-ghost')} /> Сброс пароля и сессий{' '}
          </button>
        )}
        <button className={buttonStyles.logoutButton} onClick={handleLogout}>
          <LogoutIcon /> Выйти{' '}
        </button>
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

  const handleShowPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!access) {
      api.userAPI
        .getBarmaliniAccess()
        .then((data) => {
          setAccess(data)
        })
        .catch((error) => {
          toast.error(error?.message || 'Не удалось получить пароль.')
        })
    } else {
      setAccess(undefined)
    }
  }

  return (
    <div className={styles.barmalini}>
      {(access && (
        <div>
          <div>
            <span className={styles.label}>Логин:</span> {access.login}
          </div>
          <div>
            <span className={styles.label}>Пароль:</span>&nbsp;
            <span className={styles.password} onClick={selectElementText}>
              {access.password}
            </span>
            &nbsp;
            <button className={buttonStyles.linkButton} onClick={handleCopy}>
              скопировать
            </button>
          </div>
          <div>
            <span className={styles.label}>Счастливого бармаления. Пароль истекает через час.</span>
          </div>
        </div>
      )) || (
        <button className={buttonStyles.settingsButton} onClick={handleShowPassword}>
          Бармалинить
        </button>
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
                <button className={classNames(buttonStyles.settingsButton, styles.delete)} onClick={handleDelete}>
                  Удалить
                </button>
                {!revealPublicKey && (
                  <button className={buttonStyles.settingsButton} onClick={() => setRevealPublicKey(!revealPublicKey)}>
                    Показать публичный ключ
                  </button>
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
              <button
                className={buttonStyles.settingsButton}
                onClick={() => {
                  setCreatingMailbox(true)
                }}
              >
                <span className={classNames('i i-mailbox-secure', { [styles.mailboxCreated]: !!publicKey })} />
                Создать ключ для приема шифровок
              </button>
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
