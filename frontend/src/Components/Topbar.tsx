import React, {useState} from 'react';
import styles from './Topbar.module.scss';
import {Link} from 'react-router-dom';
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
import NotificationsPopup from './NotificationsPopup';
import {observer} from 'mobx-react-lite';

export type TopbarMenuState = 'disabled' | 'open' | 'close';

type TopbarProps = {
    menuState: TopbarMenuState;
    onMenuToggle: () => void;
};

export const Topbar = observer((props: TopbarProps) => {
    const {userInfo} = useAppState();
    const {theme, setTheme} = useTheme();
    const [showNotifications, setShowNotifications] = useState(false);

    if (!userInfo) {
        return <></>;
    }

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

    const menuToggle = () => {
        props.onMenuToggle();
    };

    const menuClasses = [];
    if (props.menuState === 'close') {
        menuClasses.push(styles.menuClosed);
    }

    const handleNotificationsClose = () => {
        setShowNotifications(false);
    };

    const handleNotificationsToggle = () => {
        setShowNotifications(!showNotifications);
    };

    return (
        <>
            <div className={styles.topbar}>
                <div className={styles.left}>
                    <button className={menuClasses.join(' ')} onClick={menuToggle}><MenuIcon /></button>
                    <Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/`}><MonsterIcon /></Link>
                    <Link className={[styles.button, styles.newPost].join(' ')} to="/create"><PostIcon /> <span>Новый пост</span> </Link>
                </div>

                <div className={styles.right}>
                    <button onClick={toggleTheme}>{theme === 'dark' ? <LightIcon /> : <DarkIcon />}</button>
                    <WatchButton />
                    <NotificationsButton onClick={handleNotificationsToggle} />
                    <Link to={'/user/' + userInfo.username}><ProfileIcon /></Link>
                </div>
            </div>
            {showNotifications && <NotificationsPopup onClose={handleNotificationsClose} />}
        </>
    );
});

const WatchButton = observer(() => {
    const {userStats} = useAppState();
    return (
        <Link to={'/watch'} className={userStats.watch.comments > 0 ? styles.active : ''}><HotIcon /><span className={styles.label}>{userStats.watch.comments > 0 ? userStats.watch.comments : ''}</span></Link>
    );
});

const NotificationsButton = observer((props: React.ComponentPropsWithRef<'button'>) => {
    const {userStats} = useAppState();
    return (
        <button {...props} disabled={userStats.notifications === 0} className={userStats.notifications > 0 ? styles.active : ''}><NotificationIcon /><span className={styles.label}>{userStats.notifications > 0 ? userStats.notifications : ''}</span></button>
    );
});
