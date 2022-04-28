import React, {useEffect, useState} from 'react';
import styles from './UserPage.module.css';
import {Link, useMatch, useMatchRoute} from 'react-location';
import {useAPI} from '../AppState/AppState';
import {UserInfo, UserProfileInfo} from '../Types/UserInfo';
import {APIError} from '../API/APIBase';
import Username from '../Components/Username';
import RatingSwitch from '../Components/RatingSwitch';
import DateComponent from '../Components/DateComponent';

type ProfileStateBase = {
    status: 'loading' | 'not-found';
}
type ProfileStateError = {
    status: 'error';
    message: string;
}
type ProfileStateReady = {
    status: 'ready';
    profile: {
        profile: UserProfileInfo;
        invitedBy: UserInfo;
        invites: UserInfo[];
    };
}
type ProfileState = ProfileStateBase | ProfileStateError | ProfileStateReady;

function useProfile(username: string): ProfileState {
    const api = useAPI();
    const [state, setState] = useState<ProfileState>({ status: 'loading' });

    useEffect(() => {
        let reject = false;

        api.user.userProfile(username)
            .then(profile => {
                if (reject) {
                    return;
                }
                setState({
                    status: 'ready',
                    profile
                });
            })
            .catch(error => {
                if (reject) {
                    return;
                }
                console.log('ERROR', error);
                if (error instanceof APIError) {
                    if (error.statusCode === 404) {
                        setState({status: 'not-found'});
                        return;
                    }

                    setState({ status: 'error', message: error.message });
                    return;
                }

                setState( { status: 'error', message: 'Неизвестная ошибка' });
            });

        return () => { reject = true; }
    }, [username]);

    return state;
}

export default function UserPage() {
    const match = useMatch();
    const state = useProfile(match.params.username)
    const router = useMatchRoute();

    const isPosts = router({to: 'posts'});
    const isComments = router({to: 'comments'});
    const isProfile = !isPosts && !isComments;

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
                        <RatingSwitch rating={rating} type='user' id={user.id} double />
                    </div>
                </div>
                <div className={styles.userinfo}>
                    {isProfile && <>
                        {profile.invitedBy && <div>
                            Зарегистрирован по приглашению <Username user={profile.invitedBy} />
                        </div>}
                        {profile.invites.length > 0 && <div>
                            По его приглашениям зарегистрированы: {profile.invites.map((user, idx) => {
                                return <><Username key={idx} user={user}/>{idx < profile.invites.length - 1 ? ', ' : ''}</>;
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
