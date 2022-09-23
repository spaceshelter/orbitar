import {useParams, Link} from 'react-router-dom';
import React, {useState, useEffect, useCallback} from 'react';
import {useForm, SubmitHandler} from 'react-hook-form';
import styles from './ResetPasswordPage.module.scss';
import {useAPI} from '../AppState/AppState';
import PasswordStrengthComponent from '../Components/PasswordStrengthComponent';
import {PasswordStrength} from '../Types/PasswordStrength';
import WeakPasswordConfirmation from '../Components/WeakPasswordConfirmation';

type ResetPasswordForm = {
    email: string;
};

type NewPasswordForm = {
    password1: string;
    password2: string;
    code: string;
};

export default function ResetPasswordPage() {
    const api = useAPI();
    const {code} = useParams<{code: string}>();
    const [isResetting, setResetting] = useState(false);
    const [isResetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState<string>();
    const [newPasswordError, setNewPasswordError] = useState<string>();
    const [isCreatingNewPassword, setCreatingNewPassword] = useState(false);
    const [isNewPasswordCreated, setNewPasswordCreated] = useState(false);
    const [isLinkInvalid, setLinkInvalid] = useState(false);
    const [newPassword, setNewPassword] = useState<string>('');
    const [newPasswordStrength, setNewPasswordStrength] = useState<PasswordStrength | undefined>(undefined);
    const [isWeakPasswordConfirmed, setIsWeakPasswordConfirmed] = useState(false);

    useEffect(() => {
        if (!code) {
            return;
        }
        api.authAPI.checkResetPasswordCode(code)
            .then(result => {
                setLinkInvalid(false);
            })
            .catch(error => {
                setLinkInvalid(true);
            });
    }, [code, api]);

    const onPasswordStrengthUpdate = useCallback((newStrength: PasswordStrength | undefined) => {
        setNewPasswordStrength(newStrength);
    }, []);

    const { register: registerReset, handleSubmit: handleSubmitReset, formState: { isValid: isValidReset } } = useForm<ResetPasswordForm>({
        mode: 'onChange'
    });

    const { register: registerNewPassword, handleSubmit: handleSubmitNewPassword, formState: { errors: newPasswordErrors, isValid: isValidNewPassword } } = useForm<NewPasswordForm>({
        mode: 'onChange'
    });

    const onResetSubmit: SubmitHandler<ResetPasswordForm> = data => {
        setResetError('');
        if (!data.email || !data.email.match(/^[^@]+@.+?\..+?$/)) {
            setResetError('Нужен валидный емейл');
            return;
        }
        setResetting(true);
        api.auth.resetPassword(data.email).then(() => {
            setResetSent(true);
        }).catch(_ => {
            setResetError('Не удалось начать сброс пароля. Проверьте адрес и попробуйте ещё раз немного позже.');
        }).finally(() => {
            setResetting(false);
        });
    };

    const onNewPasswordSubmit: SubmitHandler<NewPasswordForm> = data => {
        setNewPasswordError('');
        if (data.password1 !== data.password2) {
            setNewPasswordError('Пароли не совпадают!');
            return false;
        }
        setCreatingNewPassword(true);
        api.auth.setNewPassword(data.password1, code as string).then(() => {
            setNewPasswordCreated(true);
        }).catch(_ => {
            setNewPasswordError('Не удалось установить новый пароль. Попробуйте ещё раз немного позже.');
        }).finally(() => {
            setCreatingNewPassword(false);
        });
    };

    const newPasswordFormReady = () => {
        if (newPasswordStrength !== PasswordStrength.Strong && !isWeakPasswordConfirmed) {
            return false;
        }
        return isValidNewPassword && !isCreatingNewPassword;
    };

    const weakPasswordConfirmationChanged = (e: React.FormEvent<HTMLInputElement>) => {
        setIsWeakPasswordConfirmed(e.currentTarget.checked);
    };

    if (isLinkInvalid) {
        return (
            <div className={styles.resetPassword}>
                <p className={styles.error}>Ссылка невалидна или истекла.</p>
            </div>
        );
    }

    if (code) {
        return (
            <div className={styles.resetPassword}>
                <h2>Новый пароль</h2>
                {
                    !isNewPasswordCreated && (
                        <form onSubmit={handleSubmitNewPassword(onNewPasswordSubmit)}>
                            <label>Пароль</label>
                            <input type="password" {...registerNewPassword('password1', {
                                required: true
                            })}
                                onChange={(e) => {
                                    setNewPassword(e.currentTarget.value);
                                    setNewPasswordError('');
                                }}
                            />
                            <label>Пароль ещё раз</label>
                            <input type="password" {...registerNewPassword('password2', {
                                required: true,
                                validate: (value: string) => {
                                    if (value !== newPassword) {
                                        return 'Пароли должны совпадать.';
                                    }
                                    return true;
                                }
                            })}
                            />
                            <div className={styles.passwordStrengthContainer}>
                                <PasswordStrengthComponent password={newPassword} onUpdate={onPasswordStrengthUpdate} />
                            </div>
                            <WeakPasswordConfirmation passwordStrength={newPasswordStrength} onConfirmationChanged={weakPasswordConfirmationChanged} />
                            <div><input type="submit" disabled={!newPasswordFormReady()} value="Поехали!" /></div>
                            {newPasswordErrors.password2?.message && <p className={styles.error}>{newPasswordErrors.password2.message}</p>}
                            {newPasswordError && <p className={styles.error}>{newPasswordError}</p>}
                        </form>
                    )
                }
                {
                    isNewPasswordCreated && (
                        <div className={styles.resetSent}>
                            <p>
                                Новый пароль успешно установлен!
                            </p>
                            <p>
                                <Link to='/'>Войти</Link>
                            </p>
                        </div>
                    )
                }
            </div>
        );
    }

    return (
        <div className={styles.resetPassword}>
            <h2>Забыли пароль? Или хотите его поменять?</h2>
            <form onSubmit={handleSubmitReset(onResetSubmit)}>
                <div className={styles.resetInfo}>Введите ваш емейл. На него придёт ссылка на сброс пароля</div>
                <input type="text" placeholder="ваш e-mail адрес" {...registerReset('email', {
                    required: 'Нужен емейл, чтобы отправить на него ссылку для сброса пароля.'
                })} />
                <div><input type="submit" disabled={!isValidReset || isResetting} value="Сбросить пароль"/></div>
                {resetError && <p className={styles.error}>{resetError}</p>}
            </form>
            <div className={styles.resetLink}>
                <Link to='/'>Назад к логину</Link>
            </div>
            {
                isResetSent && <div className={styles.resetSent}>
                <p>Письмо со ссылкой на сброс пароля отправлено вам на почту. Если не пришло, проверьте папку Спам.</p>
                <p>Если всё ещё не пришло, и вы пользуетесь Gmail, проверьте вкладку Promotions (Промоакции).</p>
                <p>Если совсем не приходит, <a href='https://discord.gg/j4tevpV9'>напишите нам в Дискорде</a>, что-нибудь придумаем.</p>
              </div>
            }
        </div>
    );
}
