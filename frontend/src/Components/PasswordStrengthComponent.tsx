import React, {useEffect} from 'react';
import styles from './PasswordStrength.module.scss';
import {passwordStrength} from 'check-password-strength';
import {PasswordStrength} from '../Types/PasswordStrength';

interface PasswordStrengthProps {
    password: string;
    onUpdate: (newStrength: PasswordStrength | undefined) => void;
}

export default function PasswordStrengthComponent(props: PasswordStrengthProps) {
    let newPasswordStrength = passwordStrength(props.password).id;
    // TODO: find a better password strength library, as this one doesn't account for passphrases https://xkcd.com/936/
    if (newPasswordStrength === PasswordStrength.TooWeak && props.password.length >= 12 &&
        props.password.search(/\S\s+\S/) !== -1) {
        newPasswordStrength = PasswordStrength.Weak;
    }

    useEffect(() => {
        props.onUpdate(!props.password ? undefined : newPasswordStrength);
    });
    let meterClassName, label;
    let showHint = false;
    switch (true) {
        case !props.password:
            label = ' ';
            break;
        case newPasswordStrength === PasswordStrength.TooWeak:
            meterClassName = styles.tooWeak;
            label = 'Очень слабый пароль';
            showHint = true;
            break;
        case newPasswordStrength === PasswordStrength.Weak:
            meterClassName = styles.weak;
            label = 'Слабый пароль';
            showHint = true;
            break;
        case newPasswordStrength === PasswordStrength.Medium:
            meterClassName = styles.medium;
            label = 'Средний пароль';
            showHint = true;
            break;
        case newPasswordStrength === PasswordStrength.Strong:
            meterClassName = styles.strong;
            label = 'Это отличный пароль! Вы молодец!';
            break;
    }

    return <div className={styles.container}>
        <div className={styles.meter + ' ' + meterClassName}></div>
        <div className={styles.label}>{label}</div>
        {showHint && <div className={styles.hint}>(хороший пароль должен быть достаточно длинным, и состоять из строчных и заглавных букв, цифр и символов)</div>}
    </div>;
}
