import React, { useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'

import { Topbar, TopbarMenuState } from '@components/Topbar'
import { CreatePostPage } from '@pages/CreatePostPage'
import FeedPage from '@pages/FeedPage'
import InvitePage from '@pages/InvitePage'
import LoadingPage from '@pages/LoadingPage'
import PostPage from '@pages/PostPage'
import SignInPage from '@pages/SignInPage'
import { UserPage } from '@pages/UserPage'
import { AppLoadingState, useAppState } from '@state/AppState'
import { Theme, ToastContainer } from 'react-toastify'

import styles from './App.module.css'

import './index.scss'
import 'react-toastify/dist/ReactToastify.css'

import { ForcedReload } from '@components/ForcedReload'
import { SiteSidebar } from '@components/SiteSidebar'
import ZoomComponent from '@components/ZoomComponent'
import KarmaCalculatorPage from '@pages/KarmaCalculatorPage'
import { OAuthClientPage } from '@pages/OAuthClientPage'
import ReactComponentsShowcase from '@pages/ReactComponentsShowcase'
import ResetPasswordPage from '@pages/ResetPasswordPage'
import SearchPage from '@pages/SearchPage'
import { SitesCreatePage } from '@pages/SitesCreatePage'
import { SitesPage } from '@pages/SitesPage'
import ThemePreviewPage from '@pages/ThemePreviewPage'
import WatchPage from '@pages/WatchPage'
import { useTheme } from '@theme/ThemeProvider'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { ReactComponent as MonsterIconNy } from '@assets/monster_large_ny.svg'
import { ReactComponent as MonsterIcon } from '@assets/monster_large.svg'
import { ReactComponent as SpoilerMask } from '@assets/spoiler-mask.svg'

export const App = observer(() => {
  const { appLoadingState } = useAppState()

  if (appLoadingState === AppLoadingState.loading) {
    return <Loading />
  }

  if (appLoadingState === AppLoadingState.unauthorized) {
    return <Unauthorized />
  }

  return <Ready />
})

function Loading() {
  return (
    <>
      <LoadingPage />
      <ToastContainer theme='dark' />
    </>
  )
}

function Unauthorized() {
  const { theme } = useTheme()

  return (
    <>
      <Routes>
        <Route path='*' element={<SignInPage />} />
        <Route path='/invite/:code' element={<InvitePage />} />
        <Route path='/forgot-password' element={<ResetPasswordPage />} />
        <Route path='/forgot-password/:code' element={<ResetPasswordPage />} />
      </Routes>
      <ToastContainer theme={theme as Theme} />
    </>
  )
}

const ModalContainer = observer(() => {
  const appState = useAppState()
  return (
    <>
      {appState.modal}
      {appState.mediaUploaderModal}
      {appState.confirmDialogModal}
    </>
  )
})

const ReadyContainer = observer(() => {
  const { theme } = useTheme()
  const [menuState, setMenuState] = useState<TopbarMenuState>(
    localStorage.getItem('menuState') === 'close' ? 'close' : 'open',
  )

  const handleMenuToggle = () => {
    if (menuState === 'disabled') {
      return
    }
    if (menuState === 'open') {
      setMenuState('close')
      localStorage.setItem('menuState', 'close')
    } else {
      setMenuState('open')
      localStorage.setItem('menuState', 'open')
    }
  }

  // New Year holidays: from 26 Dec to 7 Jan
  const isNewYear =
    (new Date().getMonth() === 11 && new Date().getDate() >= 26) ||
    (new Date().getMonth() === 0 && new Date().getDate() <= 7)

  const isFeb14th = new Date().getMonth() === 1 && new Date().getDate() === 14

  return (
    <>
      <Topbar menuState={menuState} onMenuToggle={handleMenuToggle} />
      <SiteSidebar menuState={menuState} onMenuToggle={handleMenuToggle} />
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <ForcedReload>
            <Outlet />
          </ForcedReload>
        </div>
      </div>

      {isNewYear && (
        <div className={classNames(styles.monster, styles.monsterNy)}>
          <MonsterIconNy />
        </div>
      )}
      {!isNewYear && (
        <div className={classNames(styles.monster, { [styles.monsterPink]: isFeb14th })}>
          <MonsterIcon />
        </div>
      )}
      <ModalContainer />
      <ZoomComponent />
      <ToastContainer theme={theme as Theme} />
      <SpoilerMask />
    </>
  )
})

const Ready = observer(() => {
  return (
    <>
      <Routes>
        <Route path='/' element={<ReadyContainer />}>
          <Route path='' element={<FeedPage />} />
          <Route path='posts' element={<FeedPage />} />
          <Route path='all' element={<FeedPage />} />
          <Route path='subscriptions' element={<FeedPage />} />
          <Route path='p:postId' element={<PostPage />} />
          <Route path='create' element={<CreatePostPage />} />

          <Route path='u/:username'>
            <Route path='' element={<UserPage />} />
            <Route path=':page' element={<UserPage />} />
            <Route path='settings' element={<MonsterIcon />} />
            <Route path='apps' element={<MonsterIcon />} />
          </Route>
          <Route path='profile'>
            <Route path='' element={<UserPage />} />
            <Route path=':page' element={<UserPage />} />
          </Route>

          <Route path='watch' element={<WatchPage />} />
          <Route path='watch/all' element={<WatchPage />} />
          <Route path='sites' element={<SitesPage />} />
          <Route path='sites/create' element={<SitesCreatePage />} />
          <Route path='theme' element={<ThemePreviewPage />} />
          <Route path='karma' element={<KarmaCalculatorPage />} />
          <Route path='search' element={<SearchPage />} />

          <Route path='s/:site'>
            <Route path='' element={<FeedPage />} />
            <Route path='create' element={<CreatePostPage />} />
            <Route path='p:postId' element={<PostPage />} />
          </Route>

          <Route path='oauth2'>
            <Route path='authorize' element={<OAuthClientPage />} />
          </Route>

          {(!process.env.NODE_ENV || process.env.NODE_ENV === 'development') && (
            <Route path='/react-components-showcase' element={<ReactComponentsShowcase />} />
          )}
        </Route>
      </Routes>
    </>
  )
})
