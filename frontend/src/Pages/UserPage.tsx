import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { observer } from 'mobx-react-lite'
import moment from 'moment'

import { useUserProfile } from '../API/use/useUserProfile'
import { useAPI, useAppState } from '../AppState/AppState'
import DateComponent from '../Components/DateComponent'
import RatingSwitch from '../Components/RatingSwitch'
import Username from '../Components/Username'
import UserProfileBio from '../Components/UserProfileBio'
import UserProfileClientsApps from '../Components/UserProfileClientsApps'
import UserProfileComments from '../Components/UserProfileComments'
import { UserProfileInvites } from '../Components/UserProfileInvites'
import { UserProfileKarma } from '../Components/UserProfileKarma'
import UserProfileName from '../Components/UserProfileName'
import UserProfilePosts from '../Components/UserProfilePosts'
import UserProfileSettings from '../Components/UserProfileSettings'
import { UserGender, UserProfileInfo } from '../Types/UserInfo'

import { ReactComponent as AliveIcon } from '../Assets/alive.svg'
import { ReactComponent as GhostIcon } from '../Assets/ghost.svg'
import styles from './UserPage.module.scss'

export const UserPage = observer(() => {
  const { userInfo, userRestrictions: restrictions } = useAppState()
  const api = useAPI()
  const params = useParams<{ username?: string; page?: string }>()
  const username = params.username || userInfo?.username
  const page = params.page || 'profile'
  const cutInvitesListInvitesNumber = 10
  const cutInvitesListToNumber = 5
  const [state, refreshProfile] = useUserProfile(username || '')

  const [inviteListTruncated, setInviteListTruncated] = useState(true)

  const isPosts = page === 'posts'
  const isComments = page === 'comments'
  const isInvites = page === 'invites'
  const isKarma = page === 'karma'
  const isSettings = page === 'settings'
  const isApps = page === 'apps'

  const isProfile = !isPosts && !isComments && !isInvites && !isKarma && !isSettings && !isApps

  useEffect(() => {
    if (state.status === 'ready') {
      document.title = state.profile.profile.username
    }
  }, [state])

  useEffect(() => {
    api.user.refreshUserRestrictions()
  }, [api])

  useEffect(() => {
    return () => setInviteListTruncated(true)
  }, [page])

  if (state.status === 'ready') {
    const profile = state.profile
    const user = profile.profile
    const sheHer = user.gender === UserGender.she
    const a = sheHer ? 'а' : ''
    const rating = { value: user.karma, vote: user.vote }
    const isMyProfile = userInfo && userInfo.id === user.id
    const base = isMyProfile ? '/profile' : '/u/' + user.username
    const invitesFullList = profile.invites.slice().sort((a: UserProfileInfo, b: UserProfileInfo) => {
      if (a.active === b.active) {
        return a.registered > b.registered ? 1 : -1
      }
      return a.active ? -1 : 1
    })
    const invitesCutList =
      invitesFullList.length > cutInvitesListInvitesNumber
        ? invitesFullList.slice(0, cutInvitesListToNumber)
        : invitesFullList

    const showInvitesList = (listToShow: UserProfileInfo[]) => {
      return (
        <>
          {listToShow.map((user, idx) => {
            return <Username key={idx} user={user} inactive={!user.active} />
          })}
          {invitesFullList.length > cutInvitesListInvitesNumber && inviteListTruncated && (
            <>
              ...{' '}
              <Link to={''} onClick={() => setInviteListTruncated(false)}>
                показать остальных
              </Link>
            </>
          )}
          {!inviteListTruncated && <Link to={base + '/invites'}>История приглашений</Link>}
        </>
      )
    }

    const handleOnVote = (value: number, vote?: number, postApiCall?: boolean) => {
      if (postApiCall) {
        refreshProfile()
      }
    }

    const handleInvitesChange = () => {
      refreshProfile()
    }

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.usernameRow}>
            <div className={styles.username}>{user.username}</div>
            <div className={styles.karma}>
              <span className={styles.active}>
                <span className={styles.statusBadge}>
                  {user.active ? <AliveIcon /> : <GhostIcon />}
                  {user.active ? (sheHer ? 'активна' : 'активен') : sheHer ? 'неактивна' : 'неактивен'}
                </span>
                {profile.visitedDaysAgo != null && (
                  <span className={styles.tooltipText}>
                    {`Был${a} в сети ${profile.visitedDaysAgo ? moment.duration(-profile.visitedDaysAgo, 'days').humanize(true) : 'сегодня'}`}
                  </span>
                )}
              </span>
              <RatingSwitch
                rating={rating}
                type='user'
                id={user.id}
                double={true}
                votingDisabled={!restrictions?.canVoteKarma}
                onVote={handleOnVote}
              />
            </div>
          </div>
          <div className={styles.name}>
            <UserProfileName name={user.name} mine={!!isMyProfile} />
          </div>
          <div className={styles.meta}>
            <span className={styles.metaInfo}>
              <span className={styles.metaItem}>#{user.id}</span>
              {profile.invitedBy ? (
                <span className={styles.metaItem}>
                  <a
                    href={`/u/${profile.invitedBy.username}/invites/#${user.username}`}
                    title={'Детальный контекст приглашения'}
                  >
                    приглашен{a}
                  </a>{' '}
                  <Username user={profile.invitedBy} />
                </span>
              ) : (
                <span className={styles.metaItem}>зарегистрирован{a}</span>
              )}
              <DateComponent date={user.registered} />
            </span>
            <span className={styles.metaCounts}>
              <Link className={`${styles.metaCount} ${isPosts ? styles.metaCountActive : ''}`} to={base + '/posts'}>
                {profile.numberOfPosts.toLocaleString()} постов
              </Link>
              <Link
                className={`${styles.metaCount} ${isComments ? styles.metaCountActive : ''}`}
                to={base + '/comments'}
              >
                {profile.numberOfComments.toLocaleString()} комментариев
              </Link>
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          <Link className={`${styles.control} ${isProfile ? styles.active : ''}`} to={base}>
            Профиль
          </Link>
          <Link className={`${styles.control} ${isKarma ? styles.active : ''}`} to={base + '/karma'}>
            Саморегуляция
          </Link>
          <Link className={`${styles.control} ${isInvites ? styles.active : ''}`} to={base + '/invites'}>
            Инвайты{' '}
            {isMyProfile && profile.numberOfInvitesAvailable
              ? '(' + profile.numberOfInvitesAvailable.toLocaleString() + ')'
              : ''}
          </Link>
          {isMyProfile && profile.hasOwnApps && (
            <Link className={`${styles.control} ${isApps ? styles.active : ''}`} to={base + '/apps'}>
              Приложения
            </Link>
          )}
          {isMyProfile && (
            <Link className={`${styles.control} ${isSettings ? styles.active : ''}`} to={base + '/settings'}>
              Настройки
            </Link>
          )}
        </div>

        <div className={styles.userinfo}>
          {isProfile && profile.invites.length > 0 && (
            <div className={styles.invitedUsers}>
              Пригласил{a}:{inviteListTruncated && showInvitesList(invitesCutList)}
              {!inviteListTruncated && showInvitesList(invitesFullList)}
            </div>
          )}
          {isProfile && (
            <UserProfileBio
              username={user.username}
              mine={!!isMyProfile}
              bio_source={profile.profile.bio_source}
              bio_html={profile.profile.bio_html}
            />
          )}
          {isPosts && <UserProfilePosts username={user.username} />}
          {isComments && <UserProfileComments username={user.username} />}
          {isInvites && <UserProfileInvites username={user.username} onInvitesChange={handleInvitesChange} />}
          {isKarma && <UserProfileKarma username={user.username} profile={profile} />}
          {isApps && <UserProfileClientsApps />}
          {isSettings && (
            <UserProfileSettings
              gender={user.gender}
              onChange={refreshProfile}
              barmaliniAccess={restrictions?.canVoteKarma && !profile.isBarmalini}
              isBarmalini={profile.isBarmalini}
              hasApps={profile.hasOwnApps}
            />
          )}
        </div>
      </div>
    )
  }

  if (state.status === 'not-found') {
    return (
      <div>
        Нет такого юзера. <Link to={'/profile/invites'}>Пригласить</Link>?
      </div>
    )
  }

  return <div>Загрузка...</div>
})
