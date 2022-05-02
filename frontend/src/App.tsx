import React from 'react';
import {Outlet, ReactLocation, Router,} from "react-location";
import {ToastContainer} from 'react-toastify';

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

const location = new ReactLocation();

function App() {
    const {appState} = useAppState();

    if (appState === AppState.loading) {
        return (
            <>
                <LoadingPage />
                <ToastContainer theme="dark" />
            </>
        );
    }

    if (appState === AppState.unauthorized) {
        return (
                <Router location={location} routes={[
                    {
                        path: '/invite/:code',
                        element: <InvitePage />
                    },
                    {
                        element: <SignInPage />
                    },
                ]}>
                    <Outlet />
                    <ToastContainer theme="dark" />
                </Router>
        );
    }

  return (
    <Router location={location} routes={[
        {
            path: '/',
            element: <FeedPage />
        },
        {
            path: '/posts',
            element: <FeedPage />
        },
        {
            path: '/post/:postId',
            element: <PostPage />
        },
        {
            path: '/user/:username',
            element: <UserPage />
        },
        {
            path: '/create',
            element: <CreatePostPage />
        }
    ]}>
        <Topbar />
        <div className={styles.container}>
            <Outlet />
        </div>
        <ToastContainer theme="dark" />
    </Router>
  );
}

export default App;
