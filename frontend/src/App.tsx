import React, { useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'

import { Theme, ToastContainer } from 'react-toastify'

import { AppLoadingState, useAppState } from './AppState/AppState'
import { Topbar, TopbarMenuState } from './Components/Topbar'
import { CreatePostPage } from './Pages/CreatePostPage'
import FeedPage from './Pages/FeedPage'
import InvitePage from './Pages/InvitePage'
import LoadingPage from './Pages/LoadingPage'
import PostPage from './Pages/PostPage'
import SignInPage from './Pages/SignInPage'
import { UserPage } from './Pages/UserPage'

import styles from './App.module.css'

import './index.scss'
import 'react-toastify/dist/ReactToastify.css'

import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { ForcedReload } from './Components/ForcedReload'
import { SiteSidebar } from './Components/SiteSidebar'
import ButtonShowcase from './Pages/ButtonShowcase'
import KarmaCalculatorPage from './Pages/KarmaCalculatorPage'
import { OAuthClientPage } from './Pages/OAuthClientPage'
import ResetPasswordPage from './Pages/ResetPasswordPage'
import SearchPage from './Pages/SearchPage'
import { SitesCreatePage } from './Pages/SitesCreatePage'
import { SitesPage } from './Pages/SitesPage'
import ThemePreviewPage from './Pages/ThemePreviewPage'
import WatchPage from './Pages/WatchPage'
import { useTheme } from './Theme/ThemeProvider'

import { ReactComponent as MonsterIconNy } from './Assets/monster_large_ny.svg'
import { ReactComponent as MonsterIcon } from './Assets/monster_large.svg'
import { ReactComponent as SpoilerMask } from './Assets/spoiler-mask.svg'

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

          <Route path='/button-showcase' element={<ButtonShowcase />} />
        </Route>
      </Routes>
    </>
  )
})
