import mediaFormStyles from './MediaUploader.module.scss';
import styles from './SecretMailbox.module.scss';
import createCommentStyles from './CreateCommentComponent.module.scss';
import React, {useEffect, useRef, useState} from 'react';
import {cryptico} from '@daotl/cryptico';
import {useDebouncedCallback} from 'use-debounce';
import classNames from 'classnames';
import Overlay from './Overlay';
import useFocus from '../API/use/useFocus';
import TextareaAutosize from 'react-textarea-autosize';
import {toast} from 'react-toastify';
import {useHotkeys} from 'react-hotkeys-hook';


let passwordCache: string | null = null;

export function SecretMailEncoderForm(props: {
    openKey: string, mailboxTitle?: string, onClose: () => void
}) {
    const [encoded, setEncoded] = useState<string>('');
    const testAreaRef = useFocus<HTMLTextAreaElement>();
    const resultRef = useRef<HTMLDivElement>(null);

    const handleTextChange = useDebouncedCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const encoded = (cryptico.encrypt(e.target.value, props.openKey, undefined as any) as any).cipher;
        setEncoded(encoded);
    }, 300);

    const renderedTitle = `Шифровка → ${props.mailboxTitle || '?'}`;
    const result = `<mail secret="${encoded}">${renderedTitle}</mail>`;

    const handleCopy = () => {
        if (!navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(result).then(() => {
            toast('В буфере!');
        }).catch();
    };

    // select all text in result div
    const handleResultClick = () => {
        if (resultRef.current) {
            const range = document.createRange();
            range.selectNodeContents(resultRef.current);
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    };

    useHotkeys(['ctrl+enter', 'meta+enter'], () => {
        handleCopy();
    }, {
        enableOnFormTags: true
    });

    return (
        <>
            <Overlay onClick={props.onClose} />
            <div className={classNames(mediaFormStyles.container, styles.container)}>
                <h3 className={classNames(styles.shortTitle)}>
                    <span className="i i-mail-secure"/>
                    <span>{renderedTitle}</span>
                </h3>
                <div className={classNames(createCommentStyles.editor, createCommentStyles.answer)}>
                    <TextareaAutosize placeholder={'Текст шифровки'}
                                      ref={testAreaRef}
                                      minRows={3} maxRows={25} maxLength={20000}
                                      onChange={handleTextChange} />
                </div>
                <span>Шифр:</span>
                <div className={styles.encodingResult} ref={resultRef} onClick={handleResultClick}>
                    {result}
                </div>
                <div className={createCommentStyles.final}>
                    <button className={classNames(styles.copyButton, mediaFormStyles.choose)} onClick={handleCopy}>Скопировать</button>
                </div>
            </div>
        </>
    );
}

export function SecretMailDecoderForm(props: {
    secret: string,
    title: string,
    onClose: () => void
}) {
    const [decoded, setDecoded] = useState<string>('');

    const passwordRef = useFocus();

    const tryDecode = (password: string | null) => {
        if (!password) {
            return;
        }
        const rsaKey = cryptico.generateRSAKey(password, 512);

        const decoded = cryptico.decrypt(props.secret, rsaKey);
        if (decoded.status === 'success') {
            setDecoded(decoded.plaintext);
            passwordCache = password;
        }
    };

    useEffect(() => {
        if (passwordCache) {
            tryDecode(passwordCache);
        }
    }, []);

    const handleDecode = useDebouncedCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        tryDecode(password);
    }, 300);

    return (
        <>
            <Overlay onClick={props.onClose} />
            <div className={classNames(mediaFormStyles.container, styles.container)}>
                <h3>
                    <span className={classNames('i', decoded ? 'i-mail-open' : 'i-mail-secure')}/>
                    <span>{props.title}</span>
                </h3>
                {decoded ?  <div className={styles.decoded}>{decoded}</div> : <>
                    <input ref={passwordRef} className={styles.input} type="password"
                           placeholder="Пароль от почтового ящика" onChange={handleDecode} />
                </>}
            </div>
        </>
    );
}

type SecretMailKeyGeneratorFormProps = {
    onSuccess: (key: string) => void;
    onCancel: () => void;
};

export function SecretMailKeyGeneratorForm(props: SecretMailKeyGeneratorFormProps) {

    const password1Ref = useRef<HTMLInputElement>(null);
    const password2Ref = useRef<HTMLInputElement>(null);
    const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
    const [passwordShown, setPasswordShown] = useState(false);

    const handlePasswordChange = () => {
        if (!password1Ref?.current?.value  || !password2Ref?.current?.value ) {
            setPasswordsMatch(null);
            return;
        }
        setPasswordsMatch(password1Ref.current.value === password2Ref.current.value);
    };

    const handleSubmit = () => {
        if (passwordsMatch === true) {
            const passwd = password1Ref?.current?.value || '';
            const privateKey = cryptico.generateRSAKey(passwd, 512);
            const publicKey = cryptico.publicKeyString(privateKey);
            props.onSuccess(publicKey);
        }
    };

    // handle keypresses
    useHotkeys(['ctrl+enter', 'meta+enter'], () => {
        handleSubmit();
    }, {
        enableOnFormTags: true
    });

    const togglePassword = () => {
        setPasswordShown(!passwordShown);
    };

    const inputType = passwordShown ? 'text' : 'password';

    return (
        <>
            <Overlay onClick={props.onCancel} />
            <div className={classNames(mediaFormStyles.container, styles.container)}>
                <h3><span className="i i-mailbox-secure"></span>
                    Создать шифрованный почтовый ящик</h3>
               <form onSubmit={(e) => {
                   e.preventDefault();
                   handleSubmit();
               }}>
               <label>Пароль</label>
               <input type={inputType} placeholder="Пароль" id={'pwd1'} ref={password1Ref} onChange={handlePasswordChange} />
               <span className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)} onClick={togglePassword}></span>

               <label>Пароль еще раз</label>
               <input type={inputType} placeholder="Пароль еще раз" id={'pwd2'} ref={password2Ref} onChange={handlePasswordChange} />
               <span className={classNames('i', passwordShown ? 'i-hide' : 'i-eye', styles.togglePass)} onClick={togglePassword}></span>

               <div className={styles.hint}>
                   {passwordsMatch === true ? <span className={classNames(mediaFormStyles.success, 'i i-thumbs-up')}> Пароли совпадают</span> :
                       passwordsMatch === false ? <span className={classNames(mediaFormStyles.error, 'i i-close')}> Пароли не совпадают</span> :
                        <span className={mediaFormStyles.warning}>Введите пароль в оба поля.</span>
                   }
               </div>
               <div className={styles.submit}><input type="submit" disabled={passwordsMatch !== true} className={mediaFormStyles.buttonSend} value="Создать" /></div>
               </form>
            </div>
        </>
    );
}
