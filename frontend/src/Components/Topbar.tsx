import React from 'react';
import styles from './Topbar.module.css';
import { FiLogOut, FiBell, FiBookmark, FiMoon, FiSun } from "react-icons/fi";

import {
    Link, useLocation, useNavigate,
} from "react-location";
import Username from './Username';
import {useAppState} from '../AppState/AppState';
import {useTheme} from '../Theme/ThemeProvider';

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

    const toggleTheme = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (theme === 'dark') {
            setTheme('light');
        }
        else {
            setTheme('dark');
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.logo}>
                <a href={'//' + process.env.REACT_APP_ROOT_DOMAIN + '/'}>
                    <img src="/logo.png" alt="Orbitar" />
                    <span className={styles.text}>Orbitar</span>
                </a>
            </div>
            <div className={styles.spacer} />
            <div className={styles.controls}>
                <Link className={styles.button} to="/settings/theme" onClick={toggleTheme}>{theme === 'dark' ? <FiMoon /> : <FiSun />}</Link>
                <Link className={styles.button} to="/my"><FiBookmark /><div className={styles.notifyCount}>∞</div></Link>
                <Link className={styles.button} to="/notifications"><FiBell /><div className={styles.notifyCount}>∞</div></Link>
                <div className={styles.karma}>{userInfo.karma}</div>
                <Username user={userInfo} className={styles.username} />
                <Link className={styles.button} to="/logout" onClick={handleLogout}><FiLogOut /></Link>
            </div>
        </div>
    )
}