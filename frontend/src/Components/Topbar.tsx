import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import Button from '@ui/Button'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { useAppState } from '../AppState/AppState'
import { Hamburger } from './Hamburger'
import NotificationsPopup from './NotificationsPopup'
import { ReloadingLink } from './ReloadingLink'

import { ReactComponent as HotIcon } from '../Assets/hot.svg'
import { ReactComponent as MonsterIcon } from '../Assets/monster.svg'
import { ReactComponent as NotificationIcon } from '../Assets/notification.svg'
import { ReactComponent as PostIcon } from '../Assets/post.svg'
import { ReactComponent as ProfileIcon } from '../Assets/profile.svg'
import { ReactComponent as SearchIcon } from '../Assets/search.svg'
import styles from './Topbar.module.scss'

export type TopbarMenuState = 'disabled' | 'open' | 'close'

type TopbarProps = {
  menuState: TopbarMenuState
  onMenuToggle: () => void
}

export const Topbar = observer((props: TopbarProps) => {
  const { userInfo } = useAppState()
  const [showNotifications, setShowNotifications] = useState(false)

  if (!userInfo) {
    return <></>
  }

  const menuToggle = () => {
    props.onMenuToggle()
  }

  const menuClasses = []
  if (props.menuState === 'close') {
    menuClasses.push(styles.menuClosed)
  }

  const handleNotificationsClose = () => {
    setShowNotifications(false)
  }

  const handleNotificationsToggle = () => {
    setShowNotifications(!showNotifications)
  }

  return (
    <>
      <div id='topbar' className={styles.topbar}>
        <div className={styles.left}>
          <Button variant='minimal' className={menuClasses.join(' ')} onClick={menuToggle}>
            <Hamburger open={props.menuState === 'close'} />
          </Button>
          <HomeButton />
          <CreateButton />
        </div>

        <div className={styles.right}>
          <SearchButton />
          <WatchButton />
          <NotificationsButton onClick={handleNotificationsToggle} />
          <Link to={'/profile'}>
            <ProfileIcon />
          </Link>
        </div>
      </div>
      {showNotifications && <NotificationsPopup onClose={handleNotificationsClose} />}
    </>
  )
})

/**
 * Home button — always links to /.
 * The feed preference (subscriptions/posts/all) is managed by FeedPage
 * via the shared useFeedPreference hook, so / always shows the right feed.
 */
const HomeButton = () => {
  return (
    <ReloadingLink className={styles.kote} to='/'>
      <MonsterIcon />
    </ReloadingLink>
  )
}

const SearchButton = () => {
  const location = useLocation()
  const isSearch = location.pathname === '/search'
  return isSearch ? (
    <></>
  ) : (
    <Link to={`/search`}>
      <SearchIcon />
    </Link>
  )
}

const CreateButton = observer(() => {
  const { site } = useAppState()

  return (
    <Link className={[styles.button, styles.newPost].join(' ')} to={site === 'main' ? '/create' : `/s/${site}/create`}>
      <PostIcon /> <span>Новый пост</span>{' '}
    </Link>
  )
})

const WatchButton = observer(() => {
  const { watchCommentsCount } = useAppState()
  return (
    <ReloadingLink to={'/watch'} className={watchCommentsCount > 0 ? styles.active : ''}>
      <HotIcon />
      <span className={styles.label}>{watchCommentsCount > 0 ? watchCommentsCount : ''}</span>
    </ReloadingLink>
  )
})

const NotificationsButton = observer((props: React.ComponentPropsWithRef<'button'>) => {
  const { unreadNotificationsCount, visibleNotificationsCount } = useAppState()

  let label = ''
  if (visibleNotificationsCount > 0) {
    if (unreadNotificationsCount > 0 && unreadNotificationsCount !== visibleNotificationsCount) {
      label = `${unreadNotificationsCount}/${visibleNotificationsCount}`
    } else {
      label = `${visibleNotificationsCount}`
    }
  }

  return (
    <Button
      variant='minimal'
      {...props}
      disabled={visibleNotificationsCount === 0}
      className={classNames({ [styles.active]: unreadNotificationsCount }, styles.notificationButton)}
    >
      <NotificationIcon />
      <span className={styles.label}>{label}</span>
    </Button>
  )
})
