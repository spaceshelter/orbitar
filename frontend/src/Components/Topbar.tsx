import React from 'react';
import styles from './Topbar.module.css';
import { FiLogOut, FiBell, FiBookmark, FiMoon, FiSun } from "react-icons/fi";

import {
    Link, useLocation, useNavigate,
} from "react-location";
import  Username from './Username';
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
            navigate({to: location.current.href, replace: true});
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
                <button><MonsterIcon /></button>
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

    // return (
    //     <div className={styles.container}>
    //
    //
    //         <div className={styles.logo}>
    //             <a href={'//' + process.env.REACT_APP_ROOT_DOMAIN + '/'}>
    //                 <img src="/logo.png" alt="Orbitar" />
    //                 <span className={styles.text}>Orbitar</span>
    //             </a>
    //         </div>
    //         <div className={styles.spacer} />
    //         <div className={styles.controls}>
    //             <Link className={styles.button} to="/settings/theme" onClick={toggleTheme}>{theme === 'dark' ? <FiMoon /> : <FiSun />}</Link>
    //             <Link className={styles.button} to="/my"><FiBookmark /><div className={styles.notifyCount}>∞</div></Link>
    //             <Link className={styles.button} to="/notifications"><FiBell /><div className={styles.notifyCount}>∞</div></Link>
    //             <div className={styles.karma}>{userInfo.karma}</div>
    //             <Username user={userInfo} className={styles.username} />
    //             <Link className={styles.button} to="/logout" onClick={handleLogout}><FiLogOut /></Link>
    //         </div>
    //     </div>
    // )
}