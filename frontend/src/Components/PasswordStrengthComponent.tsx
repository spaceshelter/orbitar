import React, {useEffect} from 'react';
import styles from './PasswordStrength.module.scss';
import {passwordStrength} from 'check-password-strength';
import {PasswordStrength} from '../Types/PasswordStrength';

interface PasswordStrengthProps {
    password: string;
    onUpdate: (newStrength: PasswordStrength | undefined) => void;
}

export default function PasswordStrengthComponent(props: PasswordStrengthProps) {
    const newPasswordStrength = passwordStrength(props.password);
    useEffect(() => {
        props.onUpdate(!props.password ? undefined : newPasswordStrength.id);
    });
    let meterClassName, label;
    switch (true) {
        case !props.password:
            label = ' ';
            break;
        case newPasswordStrength.id === PasswordStrength.TooWeak:
            meterClassName = styles.tooWeak;
            label = 'Очень слабый пароль (хороший пароль должен быть достаточно длинным, и состоять из строчных и заглавных букв, цифр и символов)';
            break;
        case newPasswordStrength.id === PasswordStrength.Weak:
            meterClassName = styles.weak;
            label = 'Слабый пароль (хороший пароль должен быть достаточно длинным, и состоять из строчных и заглавных букв, цифр и символов)';
            break;
        case newPasswordStrength.id === PasswordStrength.Medium:
            meterClassName = styles.medium;
            label = 'Средний пароль (хороший пароль должен быть достаточно длинным, и состоять из строчных и заглавных букв, цифр и символов)';
            break;
        case newPasswordStrength.id === PasswordStrength.Strong:
            meterClassName = styles.strong;
            label = 'Это отличный пароль! Вы молодец!';
            break;
    }

    return <div className={styles.container}>
        <div className={styles.meter + ' ' + meterClassName}></div>
        <div className={styles.label}>{label}</div>
    </div>;
}
