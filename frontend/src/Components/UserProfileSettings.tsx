import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {ReactComponent as UserIcon} from '../Assets/user.svg';
import {useAPI} from '../AppState/AppState';
import {useLocation, useNavigate} from 'react-router-dom';
import ThemeToggleComponent from './ThemeToggleComponent';
import {UserGender} from '../Types/UserInfo';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';

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
            {props.barmaliniAccess && <BarmaliniAccess/>}
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
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard?.writeText(password)
            ?.then(() => toast('В буфере!'))?.catch();
    };

    const handleShowPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        if (password === '') {
            api.userAPI.getBarmaliniPassword().then((data) => {
                setPassword(data.password);
                setShowPassword(true);
            }).catch((error) => {
                toast.error(error?.message || 'Не удалось получить пароль.');
            });
        } else {
            setShowPassword(!showPassword);
        }
    };

    return (
        <div>
            {!showPassword && <button className={buttonStyles.logoutButton} onClick={handleShowPassword}>
                 Бармалинить</button>}
            {showPassword && <div>
                <div className={buttonStyles.password}>
                    {password}<button  onClick={handleCopy}>в буфер</button>
                </div>
            </div>}
        </div>
    );
});