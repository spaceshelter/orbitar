import {PasswordStrength} from '../Types/PasswordStrength';
import React from 'react';
import styles from './WeakPasswordConfirmation.module.scss';

type WeakPasswordConfirmationProps = {
    passwordStrength: PasswordStrength | undefined;
    onConfirmationChanged: (e: React.FormEvent<HTMLInputElement>) => void;
};

export default function WeakPasswordConfirmation(props: WeakPasswordConfirmationProps) {
    if (props.passwordStrength === PasswordStrength.TooWeak) {
        return <></>;
    }
    return <div className={styles.weakPasswordConfirmationContainer}>
        {props.passwordStrength !== PasswordStrength.Strong && props.passwordStrength !== undefined && (
            <label className={styles.weakPasswordConfirmationLabel}>
                <input type='checkbox' onChange={props.onConfirmationChanged} /> я понял, что пароль слаб, люблю жить опасно, отстаньте от меня
            </label>
        )}
    </div>;
}
