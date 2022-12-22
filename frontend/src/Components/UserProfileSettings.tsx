import React, {useEffect} from 'react';
import styles from '../Pages/UserPage.module.scss';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {useUserProfile} from '../API/use/useUserProfile';
import {ReactComponent as DarkIcon} from '../Assets/theme_dark.svg';
import {ReactComponent as LightIcon} from '../Assets/theme_light.svg';
import {useTheme} from '../Theme/ThemeProvider';

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
  const {theme, setTheme} = useTheme();

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

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    if (theme === 'dark') {
      setTheme('light');
    }
    else {
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        if (theme === 'light') { setTheme('debugTheme'); return;  }
      }
      setTheme('dark');
    }
  };

  return (
    <div>
      <button className={styles.theme} onClick={toggleTheme}>{theme === 'dark' ? <LightIcon /> : <DarkIcon />} Сменить тему</button>
      { isMyProfile && <button className={styles.logout} onClick={handleLogout}><LogoutIcon /> Выйти </button> }
    </div>
  );
}
