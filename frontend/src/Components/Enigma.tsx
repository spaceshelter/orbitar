import styles from './MediaUploader.module.css';
import React, {useRef, useState} from 'react';
import {cryptico} from '@daotl/cryptico';
import {useDebouncedCallback} from 'use-debounce';
import classNames from 'classnames';

export function EnigmaEncoderForm(props: {
    openKey: string, forUsername?: string, onClose: () => void
}) {
    const [encoded, setEncoded] = useState<string>('');

    const handleTextChange = useDebouncedCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const encoded = (cryptico.encrypt(e.target.value, props.openKey, undefined as any) as any).cipher;
        setEncoded(encoded);
    }, 300);

    return (
        <>
            <div className={styles.overlay} onClick={props.onClose}/>
            <div className={styles.container}>
                <div className={styles.editor}><textarea placeholder={'Текст шифровки'} onChange={handleTextChange} /></div>
                <span>Шифр:</span>
                <div className={styles.final}>
                    {`<mail secret="${encoded}">Шифрованное письмо${props.forUsername ? ` для @${props.forUsername}` : ''}</mail>`}
                </div>
            </div>
        </>
    );
}

export function EnigmaSecret(props: {
    secret: string,
    title: string,
    onClose: () => void
}) {
    const [decoded, setDecoded] = useState<string>('');

    const handleDecode = useDebouncedCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        if (!password) {
            return;
        }
        const rsaKey = cryptico.generateRSAKey(password, 512);

        const decoded = cryptico.decrypt(props.secret, rsaKey);
        if (decoded.status === 'success') {
            setDecoded(decoded.plaintext);
        }
    }, 300);

    return (
        <>
            <div className={styles.overlay} onClick={props.onClose}/>
            <div className={styles.container}>
                <div>
                    <span className={classNames('i', decoded ? 'i-mail-open' : 'i-mail-secure')}/>
                    <span className={styles.title}>{props.title}</span>
                </div>
                {decoded ? decoded : <input type="password" placeholder="Пароль" onChange={handleDecode} />}
            </div>
        </>
    );
}

type EnigmaKeyGeneratorProps = {
    onSuccess: (key: string) => void;
    onCancel: () => void;
};

export function EnigmaKeyGenerator(props: EnigmaKeyGeneratorProps) {

    const password1Ref = useRef<HTMLInputElement>(null);
    const password2Ref = useRef<HTMLInputElement>(null);
    const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);

    const handlePasswordChange = () => {
        if (!password1Ref?.current?.value  || !password2Ref?.current?.value ) {
            setPasswordsMatch(null);
            return;
        }
        setPasswordsMatch(password1Ref.current.value === password2Ref.current.value);
    };

    const handleSubmit = (e: any) => {
        e.preventDefault();
        if (passwordsMatch === true) {
            const passwd = password1Ref?.current?.value || '';
            const privateKey = cryptico.generateRSAKey(passwd, 512);
            const publicKey = cryptico.publicKeyString(privateKey);
            props.onSuccess(publicKey);
        }
    };

    return (
        <>
            <div className={styles.overlay} onClick={props.onCancel}/>
            <div className={styles.container}>
               <form onSubmit={handleSubmit}>
                   <div>
                       <label htmlFor={'pwd1'}>Пароль</label><br/>
                       <input type="password" placeholder="Password" id={'pwd1'} ref={password1Ref} onChange={handlePasswordChange} />
                   </div>
                   <div>
                       <label htmlFor={'pwd2'}>Пароль еще раз</label><br/>
                       <input type="password" placeholder="Password" id={'pwd2'} ref={password2Ref} onChange={handlePasswordChange} />
                   </div>
                   <div>
                       {passwordsMatch === true ? <span className={styles.success}>✅ Пароли совпадают</span> :
                           passwordsMatch === false ? <span className={styles.error}>❌ Пароли не совпадают</span> :
                            <span className={styles.warning}>Введите пароль в оба поля.</span>
                       }
                   </div>
                   <button type={'submit'} disabled={passwordsMatch !== true} className={styles.buttonSend} onClick={handleSubmit}>Создать</button>
               </form>
            </div>
        </>
    );
}
