import React, {useEffect} from 'react';
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

export const UserPage = observer(() => {
    const {userInfo} = useAppState();
    const api = useAPI();
    const params = useParams<{username?: string, page?: string}>();

    const username = params.username || userInfo?.username;
    const page = params.page || 'profile';

    const state = useUserProfile(username || '');

    const isPosts = page === 'posts';
    const isComments = page === 'comments';
    const isInvites = page === 'invites';

    const navigate = useNavigate();
    const location = useLocation();

    const isProfile = !isPosts && !isComments && !isInvites;

    useEffect(() => {
        if (state.status === 'ready') {
            document.title = state.profile.profile.username;
        }
    }, [state]);

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
        const base = '/u/' + user.username;

        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.username}>{user.username}</div>
                    <div className={styles.name}>{user.name}</div>
                    <div className={styles.registered}>#{user.id}, зарегистрирован <DateComponent date={user.registered} /></div>
                </div>
                <div className={styles.controls}>
                    <Link className={`${styles.control} ${isProfile ? styles.active : ''}`} to={base}>Профиль</Link>
                    <Link className={`${styles.control} ${isPosts ? styles.active : ''}`} to={base + '/posts'}>Посты</Link>
                    <Link className={`${styles.control} ${isComments ? styles.active : ''}`} to={base + '/comments'}>Комментарии</Link>
                    {isMyProfile && <Link className={`${styles.control} ${isInvites ? styles.active : ''}`} to={'/profile/invites'}>Инвайты</Link>}
                    <div className={styles.karma}>
                        <RatingSwitch rating={rating} type='user' id={user.id} double={true} />
                    </div>
                </div>
                <div className={styles.userinfo}>
                    {isProfile && <>
                        {profile.invitedBy && <div>
                            Зарегистрирован по приглашению <Username user={profile.invitedBy} />
                        </div>}
                        {profile.invites.length > 0 && <div>
                            По его приглашениям зарегистрированы: {profile.invites.map((user, idx) => {
                                return <Username key={idx} user={user}/>;
                            })}
                        </div>}
                        { isMyProfile && <button className={styles.logout} onClick={handleLogout}><LogoutIcon /> Выход </button> }
                    </>}
                    {isPosts && <UserProfilePosts username={user.username} />}
                    {isComments && <UserProfileComments username={user.username} />}
                    {isInvites && <UserProfileInvites />}
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
