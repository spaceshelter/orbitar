import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {ReactComponent as UserIcon} from '../Assets/user.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import {useLocation, useNavigate} from 'react-router-dom';
import ThemeToggleComponent from './ThemeToggleComponent';
import {BarmaliniAccessResult, UserGender} from '../Types/UserInfo';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';
import styles from './UserProfileSettings.module.scss';
import classNames from 'classnames';
import {confirmAlert} from 'react-confirm-alert';
import {useUserProfile} from '../API/use/useUserProfile';
import {SecretMailKeyGeneratorForm} from './SecretMailbox';

type UserProfileSettingsProps = {
  onChange: any;
  gender: UserGender;
  barmaliniAccess?: boolean;
  isBarmalini?: boolean;
};

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
]);

export function getVideoAutopause(): boolean {
    return JSON.parse(localStorage.getItem('autoStopVideos') || 'false');
}

export function getLegacyZoom(): boolean {
    return localStorage.getItem('legacyZoom') === 'true';
}

export function getPreferredLang(): string {
    return localStorage.getItem('preferredLang') || 'ru';
}
export function getIndentScale(): string {
  let indentScale = localStorage.getItem('indentScale');
  if (indentScale === null || indentScale === undefined || indentScale === 'Auto' ) {
    indentScale = '2.5'; // auto value
  }
  document.documentElement.style.setProperty('--indent-scale', indentScale);
  return indentScale;
}

export default function UserProfileSettings(props: UserProfileSettingsProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const api = useAPI();
  const navigate = useNavigate();
  const location = useLocation();

  let gender = props.gender;

const [autoStop, setAutoStop] = React.useState<boolean>(getVideoAutopause());
const [legacyZoom, setLegacyZoom] = React.useState<boolean>(getLegacyZoom());
const [preferredLang, setPreferredLang] = React.useState<string>(getPreferredLang());
const [indentScale, setIndentScale] = React.useState<string>(getIndentScale());

const confirmWrapper = (message: string, callback: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    confirmAlert({
        title: 'Астанавитесь! Подумайте!',
        message,
        buttons: [
            {
                label: 'Да!',
                onClick: callback
            },
            {
                label: 'Отмена',
                className: 'cancel'
            }
        ],
        overlayClassName: 'orbitar-confirm-overlay'
    });
};

  const handleLogout = confirmWrapper(
      'Вы действительно хотите выйти? Вы будете вынуждены войти в аккаунт заново.', () => {
          api.auth.signOut().then(() => {
              navigate(location.pathname);
          });
      });

  const handleResetSessions = confirmWrapper(
      `Вы действительно хотите сбросить пароль и все сессии?
      Вы будете разлогинены на ВСЕХ устройствах, текущий пароль больше не будет работать.
      На почту использованную при регистрации (у вас же всё ещё есть доступ к ней?) придет ссылка для сброса пароля через которую вы сможете войти в аккаунт заново и установить новый пароль.`, () => {
          api.auth.dropPasswordAndSessions().then(() => {
              navigate(location.pathname);
          });
      }
  );

    const toggleAutoStop = () => {
        setAutoStop(!autoStop);
    };

    const toggleLegacyZoom = () => {
        setLegacyZoom(!legacyZoom);
    };

  const changeLang = (ev:  React.FormEvent<HTMLSelectElement>) => {
      const lang = ev.currentTarget.value;
      setPreferredLang(lang);
  };

  const changeIndent = (ev: React.FormEvent<HTMLSelectElement>) => {
    const indentScale = ev.currentTarget.value;
    setIndentScale(indentScale);
  };

  const handleGenderChange = (e: React.MouseEvent) => {
    e.preventDefault();
    if (gender === undefined) {
      return;
    }

    if (gender === UserGender.fluid) {
      gender = UserGender.he;
    } else if (gender === UserGender.he) {
      gender = UserGender.she;
    } else {
      gender = UserGender.fluid;
    }
    api.userAPI.saveGender(gender).then((data) => {
      props.onChange();
    }).catch((error) => {
        toast.error(error?.message || 'Не удалось сохранить.');
    });
  };

    useEffect(() => {
        localStorage.setItem('autoStopVideos', JSON.stringify(autoStop));
    }, [autoStop]);

    useEffect(() => {
        localStorage.setItem('legacyZoom', JSON.stringify(legacyZoom));
    }, [legacyZoom]);

    useEffect(() => {
        localStorage.setItem('preferredLang', preferredLang);
    }, [preferredLang]);

    useEffect(() => {
      localStorage.setItem('indentScale', indentScale);
    }, [indentScale]);

    return (
        <>
            <div>
                {gender !== undefined &&
                    <button className={buttonStyles.logoutButton} onClick={handleGenderChange}><UserIcon/> Пол: {
                        gender === UserGender.fluid ? 'не указан' : (
                            gender === UserGender.she ? 'женщина' : (
                                'мужчина'
                            )
                        )
                    } </button>}
                <button className={buttonStyles.settingsButton} onClick={toggleAutoStop}>
                    Видео автопауза: {autoStop ? 'Вкл' : 'Выкл'}
                </button>
                <button className={buttonStyles.settingsButton} onClick={toggleLegacyZoom}>
                    Легаси зум: {legacyZoom ? 'Вкл' : 'Выкл'}
                </button>
                {<ThemeToggleComponent dynamic={true} buttonLabel="Сменить тему"/>}
            </div>
            <div className={styles.select}>
                <span className={styles.selectLabel}>Язык перевода:</span>
                <select onChange={changeLang} value={preferredLang}>
                    {Array.from(languages.entries()).map(([lang, name]) => <option key={lang} value={lang}>{name}</option>)}
                </select>
            </div>
            <div className={styles.select}>
              <span className={styles.selectLabel}>Сдвиг комментария:</span>
              <select onChange={changeIndent} value={indentScale}>
                {['Auto', '1', '2', '3', '4', '5', '6', '7', '8'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                )
                )}
              </select>
            </div>
            <MailboxSettings/>
            {props.barmaliniAccess && <BarmaliniAccess/>}
            <div>
            {!props.isBarmalini && <button className={classNames(buttonStyles.settingsButton, styles.dropSessions)} onClick={handleResetSessions}>
                <span className={classNames('i i-ghost' )}/> Сброс пароля и сессий </button>}
                <button className={buttonStyles.logoutButton} onClick={handleLogout}><LogoutIcon/> Выйти </button>
            </div>
        </>
    );
}


/**
 * Component that displays the button, when clicked,
 * the button turns into a div with the password/token (got from the server via userAPi.getBarmaliniPassword)
 * and the "copy" button.
 */
const BarmaliniAccess = observer(() => {
    const api = useAPI();
    const [access, setAccess] = React.useState<BarmaliniAccessResult | undefined>();


    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        if (access === undefined) {
            return;
        }
        navigator.clipboard?.writeText(access.password)
            ?.then(() => toast('В буфере!'))?.catch();
    };

    const handleShowPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!access) {
            api.userAPI.getBarmaliniAccess().then((data) => {
                setAccess(data);
            }).catch((error) => {
                toast.error(error?.message || 'Не удалось получить пароль.');
            });
        } else {
            setAccess(undefined);
        }
    };

    // selects all text in the element
    const selectText = (e: React.MouseEvent) => {
        e.preventDefault();
        const element = e.target as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    return (
        <div className={styles.barmalini}>
            {access && <div>
                <div>
                <span className={styles.label}>Логин:</span> {access.login}</div>
                <div><span className={styles.label}>Пароль:</span>&nbsp;
                    <span className={styles.password} onClick={selectText}>{access.password}</span>
                    &nbsp;<button className={buttonStyles.linkButton} onClick={handleCopy}>скопировать</button>
                </div>
                <div><span className={styles.label}>Счастливого бармаления. Пароль истекает через час.</span></div>
            </div> || <button className={buttonStyles.settingsButton} onClick={handleShowPassword}>
                Бармалинить</button>}
        </div>
    );
});

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
    const api = useAPI();
    const {userInfo} = useAppState();
    const [state, refreshProfile] = useUserProfile(userInfo?.username || '');
    const publicKey = state.status === 'ready' && state.profile.publicKey;
    const [creatingMailbox, setCreatingMailbox] = React.useState(false);
    const [revealPublicKey, setRevealPublicKey] = React.useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        confirmAlert({
            title: 'Астанавитесь! Подумайте!',
            message: ('Вы действительно хотите удалить почтовый ящик? Вы больше не сможете получать новые шифровки, ' +
                'но вы сможете читать старые шифровки, адресованные вам.'),
            buttons: [
                {
                    label: 'Да!',
                    onClick: () => {
                        api.userAPI.savePublicKey('').then(() => {
                            refreshProfile();
                        }).catch((error) => {
                            toast.error(error?.message || 'Не удалось удалить почтовый ящик.');
                        });
                    }
                },
                {
                    label: 'Отмена',
                    className: 'cancel'
                }
            ],
            overlayClassName: 'orbitar-confirm-overlay'
        });
    };

    const handleShowPublicKey = (e: React.MouseEvent) => {
        e.preventDefault();
        if (publicKey) {
            // Copy to clipboard
            navigator.clipboard?.writeText(publicKey)
                ?.then(() => toast('В буфере!'))?.catch();
        }
    };

    const handleCreatePublicKey = (key: string) => {
        api.userAPI.savePublicKey(key).then(() => {
            refreshProfile();
        }).catch((error) => {
            toast.error(error?.message || 'Не удалось создать почтовый ящик.');
        }).finally(() => {
            setCreatingMailbox(false);
        });
    };

    return <>{state.status === 'ready' &&
        <div className={styles.mailbox}>
            {publicKey &&
                <>{/*mailbox exists*/}
                    <div className={styles.mailboxHeader}>
                        <span className={classNames('i i-mailbox-secure', {[styles.mailboxCreated]: !!publicKey})}/>
                        Почтовый ящик готов!
                    </div>
                    <div className={styles.mailboxActions}>
                        <button className={classNames(buttonStyles.settingsButton, styles.delete)}
                                onClick={handleDelete}>Удалить</button>
                        {!revealPublicKey && <button className={buttonStyles.settingsButton} onClick={() =>
                            setRevealPublicKey(!revealPublicKey)
                        }>Показать публичный ключ</button>}
                        {revealPublicKey && <div>
                            <span className={styles.label}>Публичный ключ:</span><br/>
                            <span className={styles.publicKey} onClick={handleShowPublicKey}>{publicKey}</span>
                        </div>}
                    </div>
                </> ||
                <div>{/*Mailbox doesn't exist*/}
                    <button className={buttonStyles.settingsButton} onClick={() => {
                        setCreatingMailbox(true);
                    }}>
                        <span className={classNames('i i-mailbox-secure', {[styles.mailboxCreated]: !!publicKey})}/>
                        Создать ключ для приема шифровок
                    </button>
                </div>}
        </div> || null}
        {creatingMailbox && <div className={styles.modalWrapper}><SecretMailKeyGeneratorForm
            onSuccess={handleCreatePublicKey}
            onCancel={() => setCreatingMailbox(false)}
        /></div>}
    </>;
});
