import React, {useState} from 'react';
import styles from './Topbar.module.scss';
import {Link, useLocation} from 'react-router-dom';
import {useAppState} from '../AppState/AppState';
import {ReactComponent as PostIcon} from '../Assets/post.svg';
import {ReactComponent as MonsterIcon} from '../Assets/monster.svg';
import {ReactComponent as HotIcon} from '../Assets/hot.svg';
import {ReactComponent as NotificationIcon} from '../Assets/notification.svg';
import {ReactComponent as ProfileIcon} from '../Assets/profile.svg';
import {ReactComponent as SearchIcon} from '../Assets/search.svg';
import NotificationsPopup from './NotificationsPopup';
import {Hamburger} from './Hamburger';
import {observer} from 'mobx-react-lite';

export type TopbarMenuState = 'disabled' | 'open' | 'close';

type TopbarProps = {
    menuState: TopbarMenuState;
    onMenuToggle: () => void;
};

export const Topbar = observer((props: TopbarProps) => {
    const {userInfo} = useAppState();
    const [showNotifications, setShowNotifications] = useState(false);

    if (!userInfo) {
        return <></>;
    }

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
                    <button className={menuClasses.join(' ')} onClick={menuToggle}>
                        <Hamburger open={props.menuState === 'close'} />
                    </button>
                    <Link to={`/`}><MonsterIcon /></Link>
                    <CreateButton />
                </div>

                <div className={styles.right}>
                    <SearchButton/>
                    <WatchButton />
                    <NotificationsButton onClick={handleNotificationsToggle} />
                    <Link to={'/profile'}><ProfileIcon /></Link>
                </div>
            </div>
            {showNotifications && <NotificationsPopup onClose={handleNotificationsClose} />}
        </>
    );
});

const SearchButton = () => {
    const location = useLocation();
    const isSearch = location.pathname === '/search';
    return (isSearch ? <></> : <Link to={`/search`}><SearchIcon /></Link>);
};

const CreateButton = observer(() => {
    const {site} = useAppState();

    return (
        <Link className={[styles.button, styles.newPost].join(' ')} to={site === 'main' ? '/create' : `/s/${site}/create`}><PostIcon /> <span>Новый пост</span> </Link>
    );
});

const WatchButton = observer(() => {
    const {watchCommentsCount} = useAppState();
    return (
        <Link to={'/watch'} className={watchCommentsCount > 0 ? styles.active : ''}><HotIcon /><span className={styles.label}>{watchCommentsCount > 0 ? watchCommentsCount : ''}</span></Link>
    );
});

const NotificationsButton = observer((props: React.ComponentPropsWithRef<'button'>) => {
    const {notificationsCount} = useAppState();
    return (
        <button {...props} disabled={notificationsCount === 0} className={notificationsCount > 0 ? styles.active : ''}><NotificationIcon /><span className={styles.label}>{notificationsCount > 0 ? notificationsCount : ''}</span></button>
    );
});
