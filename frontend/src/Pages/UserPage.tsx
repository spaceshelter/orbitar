import React, {useEffect} from 'react';
import styles from './UserPage.module.css';
import {Link, useMatch, useParams} from 'react-router-dom';
import Username from '../Components/Username';
import RatingSwitch from '../Components/RatingSwitch';
import DateComponent from '../Components/DateComponent';
import {useUserProfile} from '../API/use/useUserProfile';

export default function UserPage() {
    const params = useParams<{username: string}>();
    const state = useUserProfile(decodeURI(params?.username || ''));
    const isPosts = useMatch('user/:username/posts');
    const isComments = useMatch('user/:username/comments');

    const isProfile = !isPosts && !isComments;

    useEffect(() => {
        if (state.status === 'ready') {
            document.title = state.profile.profile.username;
        }
    }, [state]);

    if (state.status === 'ready') {
        const profile = state.profile;
        const user = profile.profile;
        const rating = {value: user.karma, vote: user.vote};

        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.username}>{user.username}</div>
                    <div className={styles.name}>{user.name}</div>
                    <div className={styles.registered}>#{user.id}, зарегистрирован <DateComponent date={user.registered} /></div>
                </div>
                <div className={styles.controls}>
                    <Link className={`${styles.control} ${isProfile ? styles.active : ''}`} to={'/user/' + user.username}>Профиль</Link>
                    <Link className={`${styles.control} ${isPosts ? styles.active : ''}`} to={'/user/' + user.username + '/posts'}>Посты</Link>
                    <Link className={`${styles.control} ${isComments ? styles.active : ''}`} to={'/user/' + user.username + '/comments'}>Комментарии</Link>
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
                                return <span key={idx}><Username  user={user}/>{idx < profile.invites.length - 1 ? ', ' : ''}</span>;
                            })}
                        </div>}
                    </>}
                    {isPosts && <>
                        Попозже покажем
                    </>}
                    {isComments && <>
                        И так сойдёт!
                    </>}
                </div>
            </div>
        )
    }

    if (state.status === 'not-found') {
        return (
            <div>Нет такого юзера. <Link to={'/profile/invites'}>Пригласить</Link>?</div>
        )
    }

    return (
        <div>Загрузка...</div>
    )
}
