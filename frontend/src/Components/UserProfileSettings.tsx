import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {ReactComponent as UserIcon} from '../Assets/user.svg';
import {useAPI} from '../AppState/AppState';
import {useLocation, useNavigate} from 'react-router-dom';
import ThemeToggleComponent from './ThemeToggleComponent';
import {BarmaliniAccessResult, UserGender} from '../Types/UserInfo';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';
import styles from './UserProfileSettings.module.scss';

type UserProfileSettingsProps = {
  onChange: any;
  gender: UserGender;
  barmaliniAccess?: boolean;
};

export default function UserProfileSettings(props: UserProfileSettingsProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const api = useAPI();
  const navigate = useNavigate();
  const location = useLocation();

  let gender = props.gender;

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    api.auth.signOut().then(() => {
      navigate(location.pathname);
    });
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
                {<ThemeToggleComponent dynamic={true} buttonLabel="Сменить тему"/>}
                {<button className={buttonStyles.logoutButton} onClick={handleLogout}><LogoutIcon/> Выйти </button>}
            </div>
            {props.barmaliniAccess && <BarmaliniAccess/>}
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
            </div> || <button className={buttonStyles.linkButton} onClick={handleShowPassword}>
                Бармалинить</button>}
        </div>
    );
});