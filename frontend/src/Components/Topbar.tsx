import React from 'react';
import styles from './Topbar.module.css';
import {
    Link, useLocation, useNavigate,
} from "react-router-dom";
import {useAppState} from '../AppState/AppState';
import {useTheme} from '../Theme/ThemeProvider';
import {ReactComponent as MenuIcon} from '../Assets/menu.svg';
import {ReactComponent as MonsterIcon} from '../Assets/monster.svg';
import {ReactComponent as HotIcon} from '../Assets/hot.svg';
import {ReactComponent as NotificationIcon} from '../Assets/notification.svg';
import {ReactComponent as ProfileIcon} from '../Assets/profile.svg';

export default function Topbar() {
    const {userInfo, api} = useAppState();
    const {theme, setTheme} = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    if (!userInfo) {
        return <></>
    }

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        api.auth.signOut().then(() => {
            //navigate({to: location.current.href, replace: true});
            navigate(location.pathname, { replace: true });
        });
    };

    const toggleTheme = (e: React.MouseEvent) => {
        e.preventDefault();
        if (theme === 'dark') {
            setTheme('light');
        }
        else {
            setTheme('dark');
        }
    }

    return (
        <div className={styles.topbar}>
            <div className={styles.left}>
                <button><MenuIcon /></button>
                <Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/`}><MonsterIcon /></Link>
            </div>
            <div className={styles.menu}>
                <Link className={styles.button} to="/create">Новый пост</Link>
            </div>
            <div className={styles.right}>
                <button onClick={toggleTheme} className={styles.active}><HotIcon /><span className={styles.label}>12</span></button>
                <button className={styles.active}><NotificationIcon /><span className={styles.label}>1</span></button>
                <button onClick={handleLogout}><ProfileIcon /></button>
            </div>
        </div>
    )
}