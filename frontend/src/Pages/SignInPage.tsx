import React, {useState} from 'react';
import styles from './SignInPage.module.css';
import {useForm, SubmitHandler} from 'react-hook-form';
import {useAppState} from '../AppState/AppState';
import {useLocation, useNavigate} from 'react-router-dom';
import {APIError} from '../API/APIBase';

type SignInForm = {
    username: string;
    password: string;
};

export default function SignInPage() {
    const { api } = useAppState();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSigningIn, setSigningIn] = useState(false);
    const [error, setError] = useState<string>();

    document.title = 'Вход';

    const { register, handleSubmit, formState: { errors, isValid } } = useForm<SignInForm>({
        mode: 'onChange'
    });

    const onSubmit: SubmitHandler<SignInForm> = data => {
        setSigningIn(true);
        api.auth.signIn(data.username, data.password)
            .then(() => {
                navigate(location.pathname, {replace: true});
            })
            .catch(error => {
                setSigningIn(false);

                if (error instanceof APIError) {
                    if (error.code === 'wrong-credentials') {
                        setError('Неверное имя пользователя или пароль.');
                        return;
                    }
                }

                setError('Произошла чудовищная ошибка, попробуйте позже.');
            });
    };

    return (
        <div className={styles.signup}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <label>Юзернейм</label>
                <input type="text" {...register('username', {
                    required: 'Кто ты без юзернейма?'
                })} />
                {errors.username && <p className={styles.error}>{errors.username.message}</p>}

                <label>Пароль</label>
                <input type="password" {...register('password', {
                    required: 'Дальше вы не пройдёте, пока не покажете бумаги'
                })} />
                {errors.password && <p className={styles.error}>{errors.password.message}</p>}

                <div><input type="submit" disabled={!isValid || isSigningIn} value="Войти" /></div>
                {error && <p className={styles.error}>{error}</p>}
            </form>
        </div>
    );
}
