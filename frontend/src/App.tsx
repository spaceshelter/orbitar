import React, {useEffect, useState} from 'react';
import {Routes, Route, Outlet, useMatch} from 'react-router-dom';
import {Theme, ToastContainer} from 'react-toastify';

import {AppLoadingState, useAppState} from './AppState/AppState';
import {CreatePostPage} from './Pages/CreatePostPage';

import PostPage from './Pages/PostPage';
import {Topbar, TopbarMenuState} from './Components/Topbar';
import InvitePage from './Pages/InvitePage';
import LoadingPage from './Pages/LoadingPage';
import SignInPage from './Pages/SignInPage';
import {UserPage} from './Pages/UserPage';
import FeedPage from './Pages/FeedPage';

import styles from './App.module.css';
import './index.scss';
import 'react-toastify/dist/ReactToastify.css';
import {ReactComponent as MonsterIcon} from './Assets/monster_large.svg';
import {useTheme} from './Theme/ThemeProvider';
import {SiteSidebar} from './Components/SiteSidebar';
import WatchPage from './Pages/WatchPage';
import ThemePreviewPage from './Pages/ThemePreviewPage';
import {observer} from 'mobx-react-lite';

export const App = observer(() => {
    const {appLoadingState} = useAppState();

    if (appLoadingState === AppLoadingState.loading) {
        return <Loading />;
    }

    if (appLoadingState === AppLoadingState.unauthorized) {
        return <Unauthorized />;
    }

    return <Ready />;
});

function Loading() {
    return (
        <>
            <LoadingPage />
            <ToastContainer theme="dark" />
        </>
    );
}

function Unauthorized() {
    const {theme} = useTheme();

    return (
        <>
            <Routes>
                <Route path="*" element={<SignInPage />} />
                <Route path="/invite/:code" element={<InvitePage />} />
            </Routes>
            <ToastContainer theme={theme as Theme} />
        </>
    );
}

const ReadyContainer = observer(() => {
    const {theme} = useTheme();
    const [menuState, setMenuState] = useState<TopbarMenuState>(localStorage.getItem('menuState') === 'close' ? 'close' : 'open');

    const handleMenuToggle = () => {
        if (menuState === 'disabled') {
            return;
        }
        if (menuState === 'open') {
            setMenuState('close');
            localStorage.setItem('menuState', 'close');
        }
        else {
            setMenuState('open');
            localStorage.setItem('menuState', 'open');
        }
    };

    return (
        <>
            <Topbar menuState={menuState} onMenuToggle={handleMenuToggle} />
            {menuState === 'open' && <SiteSidebar />}
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <Outlet />
                </div>
            </div>
            <div className={styles.monster}><MonsterIcon /></div>
            <ToastContainer theme={theme as Theme} />
            <SiteWatcher />
        </>
    );
});

const Ready = observer(() => {
    return (
        <>
            <Routes>
                <Route path="/" element={<ReadyContainer />}>
                    <Route path="" element={<FeedPage />} />
                    <Route path="posts" element={<FeedPage />} />
                    <Route path="subscriptions" element={<FeedPage />} />
                    <Route path="p:postId" element={<PostPage />} />
                    <Route path="create" element={<CreatePostPage />} />

                    <Route path="user/:username">
                        <Route path="" element={<UserPage />} />
                        <Route path=":page" element={<UserPage />} />
                    </Route>
                    <Route path="profile">
                        <Route path="" element={<UserPage />} />
                        <Route path=":page" element={<UserPage />} />
                    </Route>

                    <Route path="watch" element={<WatchPage />} />
                    <Route path="watch/all" element={<WatchPage />} />
                    <Route path="theme" element={<ThemePreviewPage />} />

                    <Route path="s/:site">
                        <Route path="" element={<FeedPage />} />
                        <Route path="create" element={<CreatePostPage />} />
                        <Route path="p:postId" element={<PostPage />} />
                    </Route>
                </Route>
            </Routes>
        </>
    );
});

const SiteWatcher = () => {
    const appState = useAppState();

    const match = useMatch('s/:site/*');
    useEffect(() => {
        const newSite = match?.params.site || 'main';
        if (newSite !== appState.site) {
            console.log('Change site:', newSite);
            appState.setSite(newSite);
        }
    }, [appState, match]);
    return <></>;
};