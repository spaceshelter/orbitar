import React, {useEffect} from 'react';
import styles from './UserPage.module.scss';
import {Link, useParams} from 'react-router-dom';
import Username from '../Components/Username';
import RatingSwitch from '../Components/RatingSwitch';
import DateComponent from '../Components/DateComponent';
import {useUserProfile} from '../API/use/useUserProfile';
import {useAPI, useAppState} from '../AppState/AppState';
import UserProfilePosts from '../Components/UserProfilePosts';
import UserProfileComments from '../Components/UserProfileComments';
import {UserProfileInvites} from '../Components/UserProfileInvites';
import {observer} from 'mobx-react-lite';
import {UserProfileKarma} from '../Components/UserProfileKarma';
import {UserGender} from '../Types/UserInfo';
import UserProfileSettings from '../Components/UserProfileSettings';

export const UserPage = observer(() => {
    const {userInfo, userRestrictions: restrictions} = useAppState();
    const api = useAPI();
    const params = useParams<{username?: string, page?: string}>();
    const username = params.username || userInfo?.username;
    const page = params.page || 'profile';

    const [state, refreshProfile] = useUserProfile(username || '');

    const isPosts = page === 'posts';
    const isComments = page === 'comments';
    const isInvites = page === 'invites';
    const isKarma = page === 'karma';
    const isSettings = page === 'settings';

    const isProfile = !isPosts && !isComments && !isInvites && !isKarma && !isSettings;

    useEffect(() => {
        if (state.status === 'ready') {
            document.title = state.profile.profile.username;
        }
    }, [state]);

    useEffect(() => {
        api.user.refreshUserRestrictions();
    }, [api]);

    if (state.status === 'ready') {
        const profile = state.profile;
        const user = profile.profile;
        const sheHer = user.gender === UserGender.she;
        const a = sheHer ? 'а' : '';
        const rating = {value: user.karma, vote: user.vote};
        const isMyProfile = userInfo && userInfo.id === user.id;
        const base = isMyProfile ? '/profile' : '/u/' + user.username;

        const handleOnVote = (value: number, vote?: number, postApiCall?: boolean) => {
            if (postApiCall) {
                refreshProfile();
            }
        };

        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.row}>
                        <div>
                            <div className={styles.username}>{user.username}</div>
                        </div>

                        <div className={styles.karma}>
                            {user.active && <span className={styles.active}
                                                  title={`Активно посещал${a} сайт в эту неделю`}><span
                                className={'i i-alive'}></span>&nbsp;{sheHer ? 'активна' : 'активен'}</span>}
                            {!user.active && <span className={styles.active}
                                                   title={`В последнюю неделю не заходил${a} на сайт или заходил${a} недостаточно часто, чтобы считаться ${sheHer ? 'активной' : 'активным'}`}><span
                                className={'i i-ghost'}></span>&nbsp;{sheHer ? 'неактивна' : 'неактивен'}</span>}

                            <RatingSwitch rating={rating} type='user' id={user.id} double={true} votingDisabled={!restrictions?.canVoteKarma} onVote={handleOnVote}/>
                        </div>
                    </div>
                    <div className={styles.name}>{user.name}</div>
                </div>

                <div className={styles.controls}>
                    <Link className={`${styles.control} ${isProfile ? styles.active : ''}`} to={base}>Профиль</Link>
                    <Link className={`${styles.control} ${isPosts ? styles.active : ''}`} to={base + '/posts'}>Посты ({profile.numberOfPosts.toLocaleString()})</Link>
                    <Link className={`${styles.control} ${isComments ? styles.active : ''}`} to={base + '/comments'}>Комментарии ({profile.numberOfComments.toLocaleString()})</Link>
                    <Link className={`${styles.control} ${isKarma ? styles.active : ''}`} to={base + '/karma'}>Саморегуляция</Link>
                    <Link className={`${styles.control} ${isInvites ? styles.active : ''}`} to={base + '/invites'}>Инвайты {isMyProfile && profile.numberOfInvitesAvailable ? ('(' + profile.numberOfInvitesAvailable.toLocaleString() + ')') : '' }</Link>
                    <Link className={`${styles.control} ${isSettings ? styles.active : ''}`} to={base + '/settings'}>Настройки</Link>
                </div>

                <div className={styles.userinfo}>
                    {isProfile && <>
                        <div className={styles.registered}>#{user.id},
                            {(profile.invitedBy && <>
                                <a href={`/u/${profile.invitedBy.username}/invites/#${user.username}`}
                                   title={'Детальный контекст приглашения'}>приглашен{a}</a>
                                    <Username user={profile.invitedBy}/></>) ||
                                <span>зарегистрирован{a}</span>}
                             <DateComponent date={user.registered} />
                        </div>
                        {profile.invites.length > 0 && <div>
                            Пригласил{a}: {profile.invites.map((user, idx) => {
                            return <Username key={idx} user={user} inactive={!user.active}/>;
                            })}
                        </div>}
                    </>}
                    {isPosts && <UserProfilePosts username={user.username} />}
                    {isComments && <UserProfileComments username={user.username} />}
                    {isInvites && <UserProfileInvites username={user.username} />}
                    {isKarma && <UserProfileKarma username={user.username} profile={profile} />}
                    {isSettings && <UserProfileSettings />}
                </div>
            </div>
        );
    }

    if (state.status === 'not-found') {
        return (
            <div>Нет такого юзера. <Link to={'/profile/invites'}>Пригласить</Link>?</div>
        );
    }

    return (
        <div>Загрузка...</div>
    );
});
