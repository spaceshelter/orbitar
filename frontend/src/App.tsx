import React from 'react';
import {Outlet, ReactLocation, Router,} from "react-location";
import PostPage from './Pages/PostPage';
import Topbar from './Components/Topbar';
import './index.css';
import InvitePage from './Pages/InvitePage';
import LoadingPage from './Pages/LoadingPage';
import SignInPage from './Pages/SignInPage';
import {AppState, useAppState} from './AppState/AppState';
import IndexPage from './Pages/IndexPage';
import styles from './App.module.css';
import {CreatePostPage} from './Pages/CreatePostPage';

const location = new ReactLocation();

function App() {
    const {appState} = useAppState();

    if (appState === AppState.loading) {
        return <LoadingPage />
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
                </Router>
        );
    }

  return (
    <Router location={location} routes={[
        {
            path: '/',
            element: <IndexPage />
        },
        {
            path: '/post/:postId',
            element: <PostPage />
        },
        {
            path: '/user/:username',
            element: <div>User</div>
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
    </Router>
  );
}

export default App;
