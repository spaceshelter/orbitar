import React from 'react';
import { Routes, Route, Outlet } from "react-router-dom";
import {Theme, ToastContainer} from 'react-toastify';

import {AppState, useAppState} from './AppState/AppState';
import {CreatePostPage} from './Pages/CreatePostPage';

import PostPage from './Pages/PostPage';
import Topbar from './Components/Topbar';
import InvitePage from './Pages/InvitePage';
import LoadingPage from './Pages/LoadingPage';
import SignInPage from './Pages/SignInPage';
import UserPage from './Pages/UserPage';
import FeedPage from './Pages/FeedPage';

import styles from './App.module.css';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';
import {ReactComponent as MonsterIcon} from './Assets/monster_large.svg';
import {useTheme} from './Theme/ThemeProvider';
import SiteSidebar from './Components/SiteSidebar';

export default function App() {
    const {appState} = useAppState();

    if (appState === AppState.loading) {
        return <Loading />
    }

    if (appState === AppState.unauthorized) {
        return <Unauthorized />;
    }

    return <Ready />
}

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
        <Routes>
            <Route path="/" element={<SignInPage />} />
            <Route path="/invite/:code" element={<InvitePage />} />
            <ToastContainer theme={theme as Theme} />
        </Routes>
    )
}

function ReadyContainer() {
    const {theme} = useTheme();
    const {site} = useAppState();

    return (
        <>
            <Topbar />
            {site && <SiteSidebar site={site} />}
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <Outlet />
                </div>
            </div>
            <div className={styles.monster}><MonsterIcon /></div>
            <ToastContainer theme={theme as Theme} />
        </>
    )
}

function Ready() {
    return (
        <>
            <Routes>
                <Route path="/" element={<ReadyContainer />}>
                    <Route path="" element={<FeedPage />} />
                    <Route path="posts" element={<FeedPage />} />
                    <Route path="post/:postId" element={<PostPage />} />
                    <Route path="user/:username" element={<UserPage />} />
                    <Route path="create" element={<CreatePostPage />} />
                </Route>
            </Routes>
        </>
    )
}