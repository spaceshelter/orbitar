import React, {useEffect, useState} from 'react';
import styles from './Topbar.module.scss';
import {Link, useLocation, useMatch} from 'react-router-dom';
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
import classNames from 'classnames';
import {ReloadingLink} from './ReloadingLink';
import useLocalStorage from 'use-local-storage';

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
            <div id="topbar" className={styles.topbar}>
                <div className={styles.left}>
                    <button className={menuClasses.join(' ')} onClick={menuToggle}>
                        <Hamburger open={props.menuState === 'close'} />
                    </button>
                    <HomeButton />
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

const HomeButton = () => {
    const [savedRoute, setSavedRoute] =
        useLocalStorage('homeButtonRoute', '/');

    const routes: [string, boolean][] = [];
    for (const route of ['/', '/posts', '/all']) {
        // Fine to disable, we're calling this hook a fixed number of times
        // eslint-disable-next-line react-hooks/rules-of-hooks
        routes.push([route, !!useMatch(route)]);
    }

    useEffect(() => {
        routes.forEach(([route, match]) => {
            if (match && savedRoute !== route) {
                setSavedRoute(route);
            }
        });
    }, [savedRoute, routes.map(_ => _[1]).join(':')]);

    return (
        <ReloadingLink className={styles.kote} to={savedRoute}><MonsterIcon/></ReloadingLink>
    );
};

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
        <ReloadingLink to={'/watch'} className={watchCommentsCount > 0 ? styles.active : ''}><HotIcon /><span className={styles.label}>{watchCommentsCount > 0 ? watchCommentsCount : ''}</span></ReloadingLink>
    );
});

const NotificationsButton = observer((props: React.ComponentPropsWithRef<'button'>) => {
    const {unreadNotificationsCount, visibleNotificationsCount} = useAppState();

    let label = '';
    if (visibleNotificationsCount > 0) {
        if (unreadNotificationsCount > 0  && unreadNotificationsCount !== visibleNotificationsCount) {
            label = `${unreadNotificationsCount}/${visibleNotificationsCount}`;
        } else {
            label = `${visibleNotificationsCount}`;
        }
    }

    return (
        <button {...props} disabled={visibleNotificationsCount === 0}
                className={classNames({[styles.active]: unreadNotificationsCount})}><NotificationIcon />
            <span className={styles.label}>{label}</span></button>
    );
});
