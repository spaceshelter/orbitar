import React, {useEffect, useState} from 'react';
import styles from './UserPage.module.scss';
import {Link, useLocation, useNavigate, useParams} from 'react-router-dom';
import Username from '../Components/Username';
import RatingSwitch from '../Components/RatingSwitch';
import DateComponent from '../Components/DateComponent';
import {useUserProfile} from '../API/use/useUserProfile';
import {ReactComponent as LogoutIcon} from '../Assets/logout.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import UserProfilePosts from '../Components/UserProfilePosts';
import UserProfileComments from '../Components/UserProfileComments';
import {UserProfileInvites} from '../Components/UserProfileInvites';
import {observer} from 'mobx-react-lite';
import {UserProfileKarma} from '../Components/UserProfileKarma';
import ContentComponent from '../Components/ContentComponent';
import classNames from 'classnames';

export const UserPage = observer(() => {
    const {userInfo, userRestrictions: restrictions} = useAppState();
    const api = useAPI();
    const params = useParams<{username?: string, page?: string}>();
    const username = params.username || userInfo?.username;
    const page = params.page || 'profile';

    const [state, refreshProfile] = useUserProfile(username || '');
    const [showReason, setShowReason] = useState(false);
    const toggleInviteReason = (e: any) => {
        e.preventDefault();
        setShowReason(!showReason);
        return false;
    };

    const isPosts = page === 'posts';
    const isComments = page === 'comments';
    const isInvites = page === 'invites';
    const isKarma = page === 'karma';

    const navigate = useNavigate();
    const location = useLocation();

    const isProfile = !isPosts && !isComments && !isInvites && !isKarma;

    useEffect(() => {
        if (state.status === 'ready') {
            document.title = state.profile.profile.username;
        }
    }, [state]);

    useEffect(() => {
        api.user.refreshUserRestrictions();
    }, [api]);

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        api.auth.signOut().then(() => {
            navigate(location.pathname);
        });
    };

    if (state.status === 'ready') {
        const profile = state.profile;
        const user = profile.profile;
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
                            {user.active && <span className={styles.active} title={'Активно посещал сайт в эту неделю'}><span className={'i i-alive'}></span>&nbsp;активен</span>}
                            {!user.active && <span className={styles.active} title={'В последнюю неделю не заходил на сайт или заходил недостаточно часто, чтобы считаться активным'}><span className={'i i-ghost'}></span>&nbsp;неактивен</span>}

                            <RatingSwitch rating={rating} type='user' id={user.id} double={true} votingDisabled={!restrictions?.canVoteKarma} onVote={handleOnVote}/>
                        </div>
                    </div>
                    <div className={styles.name}>{user.name}</div>
                </div>

                <div className={styles.controls}>
                    <Link className={`${styles.control} ${isProfile ? styles.active : ''}`} to={base}>Профиль</Link>
                    <Link className={`${styles.control} ${isPosts ? styles.active : ''}`} to={base + '/posts'}>Посты</Link>
                    <Link className={`${styles.control} ${isComments ? styles.active : ''}`} to={base + '/comments'}>Комментарии</Link>
                    <Link className={`${styles.control} ${isKarma ? styles.active : ''}`} to={base + '/karma'}>Саморегуляция</Link>
                    {isMyProfile && <Link className={`${styles.control} ${isInvites ? styles.active : ''}`} to={'/profile/invites'}>Инвайты</Link>}
                </div>

                <div className={styles.userinfo}>
                    {isProfile && <>
                        <div className={styles.registered}>#{user.id},
                            {profile.invitedBy && <>
                                {(profile.trialApprovers || profile.invitedReason) &&
                                    <a href={'#'} title={'Детальный контекст приглашения'} onClick={toggleInviteReason}>приглашен</a> ||
                                    <span>приглашен</span>}
                                <Username user={profile.invitedBy} /></> || <span>зарегистрирован</span>}
                             <DateComponent date={user.registered} />
                        </div>

                        {showReason && <>
                        {!!profile.trialApprovers && <>
                            {profile.trialApprovers.find(u => u.vote > 0) && <div>Приглашение поддержали:
                                {profile.trialApprovers.map(user => user.vote > 0 && <Username key={user.username} user={user}/>)}
                            </div>}
                            {profile.trialApprovers.find(u => u.vote < 0) && <div>Против приглашения были:
                                {profile.trialApprovers.map(user => user.vote < 0 && <Username key={user.username} user={user}/>)}
                            </div>}
                        </>}
                        {!!profile.invitedReason && <div className={'content'}>Причина приглашения: <ContentComponent content={profile.invitedReason}/></div>}
                        </>}
                        {profile.invites.length > 0 && <div>
                            Пригласил: {profile.invites.map((user, idx) => {
                            return <Username key={idx} user={user}
                                             className={classNames({[styles.inactive]: !user.active})}/>;
                            })}
                        </div>}
                        { isMyProfile && <button className={styles.logout} onClick={handleLogout}><LogoutIcon /> Выход </button> }
                    </>}
                    {isPosts && <UserProfilePosts username={user.username} />}
                    {isComments && <UserProfileComments username={user.username} />}
                    {isInvites && <UserProfileInvites />}
                    {isKarma && <UserProfileKarma username={user.username} trialProgress={profile?.trialProgress} />}
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
