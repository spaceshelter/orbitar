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
    return  <>
    {props.passwordStrength !== PasswordStrength.Strong && props.passwordStrength !== undefined &&
            <div className={styles.weakPasswordConfirmationContainer}>
                <input id="check1" type='checkbox' onChange={props.onConfirmationChanged} />
                <label htmlFor="check1" className={styles.weakPasswordConfirmationLabel}>
                    Я понимаю, что пароль слабый, но я люблю риск! Отстаньте от меня!
                </label>
            </div>
    }
    </>;
}
