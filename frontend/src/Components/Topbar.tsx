import React from 'react';
import styles from './Topbar.module.css';
import { FiLogOut, FiBell, FiBookmark } from "react-icons/fi";

import {
    Link, useLocation, useNavigate,
} from "react-location";
import Username from './Username';
import {useAppState} from '../AppState/AppState';

export default function Topbar() {
    const {userInfo, api} = useAppState();
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

    return (
        <div className={styles.container}>
            <Link className={styles.logo} to="/"><img src="/logo.png" alt="Orbitar" /> Orbitar</Link>
            {/*<MyThings posts={10} comments={20} />*/}
            <div className={styles.user}>
                <Link className={styles.notify} to="/my"><FiBookmark /><div className={styles.notifyCount}>∞</div></Link>
                <Link className={styles.notify} to="/notifications"><FiBell /><div className={styles.notifyCount}>∞</div></Link>
                <div className={styles.karma}>{userInfo.karma}</div>
                <div className={styles.username}><Username user={userInfo} /></div>
                <Link className={styles.logout} to="/logout" onClick={handleLogout}><FiLogOut /></Link>
            </div>
        </div>
    )
}