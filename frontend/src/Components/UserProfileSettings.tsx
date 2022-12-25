import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {ReactComponent as UserIcon} from '../Assets/user.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {useUserProfile} from '../API/use/useUserProfile';
import ThemeToggleComponent from './ThemeToggleComponent';
import {UserGender} from '../Types/UserInfo';

export default function UserProfileSettings() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const api = useAPI();
  const {userInfo} = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{username?: string, page?: string}>();
  const username = params.username || userInfo?.username;
  const [state, refresh] = useUserProfile(username || '');

  let isMyProfile: boolean | undefined = false;
  let gender: UserGender = UserGender.fluid;
  const isReady = state.status === 'ready';
  if (isReady) {
    isMyProfile = userInfo && userInfo.id === state.profile.profile.id;
    gender = state.profile.profile.gender;
  }

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
      refresh();
    });
  };

  return (
    <div>
      {isReady && gender !== undefined && <button className={buttonStyles.logoutButton} onClick={handleGenderChange}><UserIcon /> Пол: {
        gender === UserGender.fluid ? 'не указан' : (
          gender === UserGender.she ? 'женщина' : (
            'мужчина'
          )
        )
      } </button>}
      {isReady && isMyProfile && <ThemeToggleComponent dynamic={true} buttonLabel='Сменить тему' /> }
      {isReady && isMyProfile && <button className={buttonStyles.logoutButton} onClick={handleLogout}><LogoutIcon /> Выйти </button> }
    </div>
  );
}
