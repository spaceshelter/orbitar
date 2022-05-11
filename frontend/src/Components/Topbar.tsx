import React from 'react';
import styles from './Topbar.module.scss';
import {
    Link, useLocation, useNavigate,
} from "react-router-dom";
import {useAppState} from '../AppState/AppState';
import {useTheme} from '../Theme/ThemeProvider';
import {ReactComponent as PostIcon} from '../Assets/post.svg';
import {ReactComponent as MenuIcon} from '../Assets/menu.svg';
import {ReactComponent as MonsterIcon} from '../Assets/monster.svg';
import {ReactComponent as HotIcon} from '../Assets/hot.svg';
import {ReactComponent as NotificationIcon} from '../Assets/notification.svg';
import {ReactComponent as ProfileIcon} from '../Assets/profile.svg';
import {ReactComponent as DarkIcon} from '../Assets/theme_dark.svg';
import {ReactComponent as LightIcon} from '../Assets/theme_light.svg';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';

export type TopbarMenuState = 'disabled' | 'open' | 'close';

type TopbarProps = {
    menuState: TopbarMenuState;
    onMenuToggle: () => void;
}

export default function Topbar(props: TopbarProps) {
    const {userInfo, api, userStats} = useAppState();
    const {theme, setTheme} = useTheme();
    const navigate = useNavigate();
    const location = useLocation();


    if (!userInfo) {
        return <></>
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
            setTheme('dark');
        }
    }

    const menuToggle = () => {
        props.onMenuToggle();
    }

    let menuClasses = [];
    if (props.menuState === 'close') {
        menuClasses.push(styles.menuClosed);
    }

    return (
        <div className={styles.topbar}>
            <div className={styles.left}>
                <button className={menuClasses.join(' ')} onClick={menuToggle}><MenuIcon /></button>
                <Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/`}><MonsterIcon /></Link>
                <Link className={[styles.button, styles.newPost].join(' ')} to="/create"><PostIcon /> <span>Новый пост</span> </Link>
            </div>

            <div className={styles.right}>
                <button onClick={toggleTheme}>{theme === 'dark' ? <LightIcon /> : <DarkIcon />}</button>
                <Link to={'/watch'} className={userStats.watch.comments > 0 ? styles.active : ''}><HotIcon /><span className={styles.label}>{userStats.watch.comments > 0 ? userStats.watch.comments : ''}</span></Link>
                <button disabled={true} className={userStats.notifications > 0 ? styles.active : ''}><NotificationIcon /><span className={styles.label}>{userStats.notifications > 0 ? userStats.notifications : ''}</span></button>
                <Link to={'/user/' + userInfo.username}><ProfileIcon /></Link>
                <button className={styles.logout} onClick={handleLogout}><LogoutIcon /></button>
            </div>
        </div>
    )
}