import React, {useEffect} from 'react';
import buttonStyles from '../Components/Buttons.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {useUserProfile} from '../API/use/useUserProfile';
import ThemeToggleComponent from './ThemeToggleComponent';

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
  const [state] = useUserProfile(username || '');

  let isMyProfile: boolean | undefined = false;
  if (state.status === 'ready') {
    isMyProfile = userInfo && userInfo.id === state.profile.profile.id;
  }

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    api.auth.signOut().then(() => {
      navigate(location.pathname);
    });
  };

  return (
    <div>
      { isMyProfile && <ThemeToggleComponent dynamic={true} buttonLabel='Сменить тему' /> }
      { isMyProfile && <button className={buttonStyles.logoutButton} onClick={handleLogout}><LogoutIcon /> Выйти </button> }
    </div>
  );
}
