import {SubmitHandler, useForm} from 'react-hook-form';
import React, {useRef} from 'react';
import styles from './SignUpForm.module.css';
import {UserGender} from '../Types/UserInfo';

type SignUpFormValues = {
    username: string;
    name: string;
    password1: string;
    password2: string;
    email: string;
};

export type SignUpFormErrors = {
    submit?: {
        message: string;
    };
    username?: {
        message: string;
    };
};

type SignUpFormProps = {
    onSignUp: (username: string, name: string, email: string, password: string, gender: UserGender) => void;
    disabled: boolean;
    errors: SignUpFormErrors;
};

export default function SignUpForm(props: SignUpFormProps) {
    const { register, handleSubmit, watch, formState: { errors, isValid } } = useForm<SignUpFormValues>({
        mode: 'onChange'
    });

    const password = useRef({});
    password.current = watch('password1', '');
    const onSubmit: SubmitHandler<SignUpFormValues> = data => {
        props.onSignUp(data.username, data.name, data.email, data.password1, UserGender.fluid);
    };

    return (
        <div className={styles.signup}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <label>Юзернейм</label>
                <input type="text" {...register('username', {
                    required: 'Юзернейм необходим каждому уважающему себя юзернейму',
                    pattern: {
                        value: /^[a-zа-яё\d_-]{2,30}$/i,
                        message: 'Только буквы, цифры, подчёркивание и минус'
                    },
                    disabled: props.disabled
                })} />
                {errors.username && <p className={styles.error}>{errors.username.message}</p>}
                {props.errors.username && <p className={styles.error}>{props.errors.username.message}</p>}

                <label>Имя</label>
                <input type="text" {...register('name', {
                    required: 'Всем интересно знать, как тебя зовут',
                    disabled: props.disabled
                })} />
                {errors.name && <p className={styles.error}>{errors.name.message}</p>}

                <label>Почта</label>
                <input type="email" {...register('email', {
                    required: 'На почту отправим новый пароль, если старый вдруг потеряется',
                    pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Неправильный адрес'
                    },
                    disabled: props.disabled
                })} />
                {errors.email && <p className={styles.error}>{errors.email.message}</p>}

                <label>Пароль</label>
                <input type="password" {...register('password1', {
                    required: 'Пароль жизненно важен',
                    disabled: props.disabled
                })} />
                {errors.password1 && <p className={styles.error}>{errors.password1.message}</p>}

                <label>Пароль ещё раз</label>
                <input type="password" {...register('password2', {
                    required: true,
                    validate: value => value === password.current || 'Пароли должны совпадать',
                    disabled: props.disabled
                })} />
                {errors.password2 && <p className={styles.error}>{errors.password2.message}</p>}

                <div><input type="submit" disabled={!isValid || props.disabled} value="Поехали!" /></div>
                {props.errors.submit && <p className={styles.error}>{props.errors.submit.message}</p>}
            </form>
        </div>
    );
}
