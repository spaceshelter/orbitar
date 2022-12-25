import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {ReactComponent as UserIcon} from '../Assets/user.svg';
import {useAPI} from '../AppState/AppState';
import {useLocation, useNavigate} from 'react-router-dom';
import ThemeToggleComponent from './ThemeToggleComponent';
import {UserGender} from '../Types/UserInfo';

type UserProfileSettingsProps = {
  onChange: any;
  gender: UserGender;
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
    });
  };

  return (
    <div>
      {gender !== undefined && <button className={buttonStyles.logoutButton} onClick={handleGenderChange}><UserIcon /> Пол: {
        gender === UserGender.fluid ? 'не указан' : (
          gender === UserGender.she ? 'женщина' : (
            'мужчина'
          )
        )
      } </button>}
      {<ThemeToggleComponent dynamic={true} buttonLabel='Сменить тему' /> }
      {<button className={buttonStyles.logoutButton} onClick={handleLogout}><LogoutIcon /> Выйти </button> }
    </div>
  );
}
