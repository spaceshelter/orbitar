import {SubmitHandler, useForm} from 'react-hook-form';
import React, {useRef, useState} from 'react';
import styles from './SignUpForm.module.scss';
import {UserGender} from '../Types/UserInfo';
import PasswordStrengthComponent from '../Components/PasswordStrengthComponent';
import {PasswordStrength} from '../Types/PasswordStrength';
import WeakPasswordConfirmation from './WeakPasswordConfirmation';
import classNames from 'classnames';

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

    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | undefined>(undefined);
    const [isWeakPasswordConfirmed, setIsWeakPasswordConfirmed] = useState(false);
    const [passwordShown, setPasswordShown] = useState(false);

    const password = useRef({});
    password.current = watch('password1', '');

    const formReady = () => {
        if (passwordStrength === PasswordStrength.TooWeak) {
            return false;
        }
        return isValid && !props.disabled && (passwordStrength === PasswordStrength.Strong || isWeakPasswordConfirmed);
    };

    const weakPasswordConfirmationChanged = (e: React.FormEvent<HTMLInputElement>) => {
        setIsWeakPasswordConfirmed(e.currentTarget.checked);
    };

    const togglePassword = () => {
        setPasswordShown(!passwordShown);
    };

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
                <input type={passwordShown ? 'text' : 'password'} {...register('password1', {
                    required: 'Пароль жизненно важен',
                    disabled: props.disabled
                })} />
                <span className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)} onClick={togglePassword}></span>
                {errors.password1 && <p className={styles.error}>{errors.password1.message}</p>}

                <label>Пароль ещё раз</label>
                <input type={passwordShown ? 'text' : 'password'} {...register('password2', {
                    required: 'Повторение мать учения',
                    validate: value => value === password.current || 'Пароли должны совпадать',
                    disabled: props.disabled
                })} />
                <span className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)} onClick={togglePassword}></span>
                {errors.password2 && <p className={styles.error}>{errors.password2.message}</p>}

                <div className={styles.passwordStrengthContainer}>
                    <PasswordStrengthComponent password={password.current as string} onUpdate={setPasswordStrength} />
                </div>
                <WeakPasswordConfirmation onConfirmationChanged={weakPasswordConfirmationChanged} passwordStrength={passwordStrength} />
                <div><input type="submit" disabled={!formReady()} value="Поехали!" /> </div>
                {props.errors.submit && <p className={styles.error}>{props.errors.submit.message}</p>}
            </form>
        </div>
    );
}
