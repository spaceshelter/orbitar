import React, {useState, useEffect} from 'react';
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
            label = 'Без пароля никак';
            break;
        case newPasswordStrength.id === PasswordStrength.TooWeak:
            meterClassName = styles.tooWeak;
            label = 'Очень слабый пароль';
            break;
        case newPasswordStrength.id === PasswordStrength.Weak:
            meterClassName = styles.weak;
            label = 'Слабый пароль';
            break;
        case newPasswordStrength.id === PasswordStrength.Medium:
            meterClassName = styles.medium;
            label = 'Средний пароль';
            break;
        case newPasswordStrength.id === PasswordStrength.Strong:
            meterClassName = styles.strong;
            label = 'Хороший пароль! Вы молодец!';
            break;
    }

    return <div className={styles.container}>
        <div className={styles.meter + ' ' + meterClassName}></div>
        <div className={styles.label}>{label}</div>
    </div>;
}
