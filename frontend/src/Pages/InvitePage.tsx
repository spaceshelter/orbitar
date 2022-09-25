import React, {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import SignUpForm, {SignUpFormErrors} from '../Components/SignUpForm';
import {useNavigate, useParams} from 'react-router-dom';
import {APIError} from '../API/APIBase';
import {UserGender} from '../Types/UserInfo';
import styles from './InvitePage.module.scss';

enum InviteState {
    unknown,
    used,
    active,
    rateLimit,
    error = 4
}

export default function InvitePage() {
    const [inviteStatus, setInviteStatus] = useState<{state: InviteState, code?: string, username?: string}>({ state: InviteState.unknown });
    const [formDisabled, setFormDisabled] = useState(false);
    const [formErrors, setFormErrors] = useState<SignUpFormErrors>({});
    const api = useAPI();
    const {code} = useParams<{code: string}>();
    const navigate = useNavigate();

    document.title = 'Вход в луна-парк!';

    useEffect(() => {
        if (!code) {
            return;
        }

        api.inviteAPI.check(code)
            .then(result => {
                setInviteStatus({ state: InviteState.active, username: result.inviter, code: result.code });
            })
            .catch(error => {
                if (error instanceof APIError) {
                    if (error.code === 'rate-limit') {
                        setInviteStatus({state: InviteState.rateLimit});
                        return;
                    }
                    if (error.code === 'invalid-invite') {
                        setInviteStatus({state: InviteState.used});
                        return;
                    }
                }
                setInviteStatus({ state: InviteState.error });
            });
    }, [code, api]);

    const handleSignUp = (username: string, name: string, email: string, password: string, gender: UserGender) => {
        if (!code) {
            return;
        }
        setFormDisabled(true);
        api.inviteAPI.use(code, username, name, email, password, gender)
            .then(result => {
                setFormDisabled(false);
                console.log('USE SUCCESS', result);
                navigate('/');
                api.init().then();
            })
            .catch(error => {
                setFormDisabled(false);
                console.log('USE ERROR', error);
                if (error instanceof APIError) {
                    if (error.code === 'rate-limit') {
                        setInviteStatus({state: InviteState.rateLimit});
                        return;
                    }
                    if (error.code === 'invalid-invite') {
                        setInviteStatus({state: InviteState.used});
                        return;
                    }
                    if (error.code === 'username-exists') {
                        setFormErrors({username: { message: `Юзернейм ${username} уже занят.` }});
                        return;
                    }
                }
                setFormErrors({submit: { message: `При регистрации произошла какая-то странная ошибка. Может в другой раз повезёт?` }});
            });
    };

    return (
        <>
            { inviteStatus.state === InviteState.unknown && <div>Проверяем приглашение...</div> }
            { inviteStatus.state === InviteState.used && <div>Такого приглашения нет! :(</div> }
            { inviteStatus.state === InviteState.rateLimit && <div>Что-то вы зачастили! Попробуйте попозже.</div> }
            { inviteStatus.state === InviteState.error && <div>Произошла чудовищная ошибка! Попробуйте попозже.</div> }
            { inviteStatus.state === InviteState.active &&
                <div className={styles.wrapper}>
                    <div className={styles.info}>Приглашение от {inviteStatus.username}</div>
                    <SignUpForm onSignUp={handleSignUp} disabled={formDisabled} errors={formErrors} />
                </div>
            }
        </>
    );
}