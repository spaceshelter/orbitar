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
import {useHotkeys} from 'react-hotkeys-hook';
import {b64EncodeUnicode} from '../Utils/utils';
import {useAPI, useAppState} from '../AppState/AppState';
import OutsideClickHandler from 'react-outside-click-handler';


let passwordCache: string | null = null;

export function SecretMailEncoderForm(props: {
    openKey: string,
    forUsername?: string,
    mailboxTitle?: string, onClose: (result?: string) => void
}) {
    const [encoded, setEncoded] = useState<string>('');
    const testAreaRef = useFocus<HTMLTextAreaElement>();
    const resultRef = useRef<HTMLDivElement>(null);
    const currentUsername = useAppState().userInfo?.username;
    const [ownPublicKey, setOwnPublicKey] =
        useState<false | string | undefined>(false);

    const api = useAPI();

    // fetch own public key
    useEffect(() => {
        if (currentUsername) {
            api.postAPI.getPublicKeyByUsername(currentUsername).then((key) => {
                setOwnPublicKey(key?.publicKey);
            });
        }
    }, [currentUsername, api]);

    const encode = () => {
        const sourceText = (testAreaRef.current?.value || '').trim();
        if (!sourceText) {
            return '';
        }

        const randomAESKey = cryptico.generateAESKey();
        const aesKeyString = cryptico.bytes2string(randomAESKey);
        const msgCypher = cryptico.encryptAESCBC(sourceText, randomAESKey);

        const cipherTo: string = (cryptico.encrypt(
            aesKeyString, props.openKey, undefined as any) as any).cipher;

        const cipherFrom: string | undefined = ownPublicKey && (cryptico.encrypt(
            aesKeyString, ownPublicKey, undefined as any) as any).cipher;

        const json = {
            to: props.forUsername,
            from: currentUsername,
            toKey: cipherTo,
            fromKey: cipherFrom,
            c: msgCypher,
            v: 1
        };
        return b64EncodeUnicode(JSON.stringify(json));
    };

    const handleTextChange = useDebouncedCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEncoded(encode());
    }, 300);

    const getResult = (encoded: string) =>
        encoded && `<mail secret="${encoded}">${props.mailboxTitle || 'Шифровка'}</mail>`;

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

    const handleSubmit = () => {
        props.onClose(getResult(encode()));
    };

    useHotkeys(['ctrl+enter', 'meta+enter'], () => {
        handleSubmit();
    }, {
        enableOnFormTags: true
    });

    return (
        <>
            <Overlay onClick={() => {
                props.onClose();
            }}/>
            <div className={classNames(mediaFormStyles.container, styles.container, styles.modal)}>
                <h3 className={classNames(styles.shortTitle)}>
                    <span className="i i-mail-secure"/>
                    <span>{`${props.mailboxTitle && props.mailboxTitle || 'Написать шифровку'}`}</span>
                </h3>
                {(!ownPublicKey && ownPublicKey !== false) && <div className={styles.info}>
                    <p>
                        ⚠️ Вы не сможете прочитать это свое сообщение после отправки,
                        так как не создали свой шифрованный почтовый ящик.
                    </p>
                </div>}
                <div className={classNames(createCommentStyles.editor, createCommentStyles.answer)}>
                    <TextareaAutosize placeholder={'Текст шифровки'}
                                      ref={testAreaRef}
                                      minRows={3} maxRows={25} maxLength={20000}
                                      onChange={handleTextChange} />
                </div>
                {encoded && <>
                <span>Результат шифрования:</span>
                <div className={styles.encodingResult} ref={resultRef} onClick={handleResultClick}>
                    {getResult(encoded)}
                </div>
                </>}
                <div className={createCommentStyles.final}>
                    <button className={classNames(styles.copyButton, mediaFormStyles.choose)} onClick={handleSubmit}>Готово</button>
                </div>
            </div>
        </>
    );
}

export function SecretMailDecoderForm(props: {
    encodedKey: string,
    cipher: string,
    title: string,
    onClose: (result: boolean) => void
}) {
    const tryDecode = (password: string | null) => {
        if (!password) {
            return null;
        }
        const rsaKey = cryptico.generateRSAKey(password, 512);

        const decoded = cryptico.decrypt(props.encodedKey, rsaKey);
        if (decoded.status === 'success') {
            passwordCache = password;

            const aesKey = cryptico.string2bytes(decoded.plaintext);
            const decrypted = cryptico.decryptAESCBC(props.cipher, aesKey);

            props.onClose(true);
            return decrypted;
        }
        return null;
    };

    const [decoded, setDecoded] = useState<string>(
        passwordCache && tryDecode(passwordCache) || ''
    );

    const passwordRef = useFocus();
    const [wrongPassword, setWrongPassword] = useState(false);


    const handleDecode = useDebouncedCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        const res = tryDecode(password);
        if (res) {
            setDecoded(res);
        }
        setWrongPassword(!!password.length && !res);
    }, 300);

    return decoded ? <>{decoded}</> : <>
        <OutsideClickHandler onOutsideClick={() => {
            if (!decoded) {
                props.onClose(false);
            }
        }}><div className={classNames(styles.container)}>
            <h3>
                <span className={classNames('i', decoded ? 'i-mail-open' : 'i-mail-secure')}/>
                <span>{props.title}</span>
            </h3>
            <div className={styles.decoded}>{decoded}</div>
            <>
                <input autoFocus={true} ref={passwordRef} className={styles.decodeInput} type="password"
                       placeholder="Пароль от почтового ящика" onChange={handleDecode}
                />
                {wrongPassword && <div className={styles.hint}>
                    <span className={classNames(mediaFormStyles.error, 'i i-close')}>Пароль не подходит.</span></div>}
            </>
        </div></OutsideClickHandler>
    </>;
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
    const [cut, setCut] = useState(true);

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
            <div className={classNames(mediaFormStyles.container, styles.container, styles.modal)}>
                <h3><span className="i i-mailbox-secure"></span>
                    Создать шифрованный почтовый ящик</h3>
               <form onSubmit={(e) => {
                   e.preventDefault();
                   handleSubmit();
               }}>
               <div className={styles.info}>
                   <p>
                   Создайте ваш новый пароль для расшифровки адресованных вам секретных соообщений
                       (также для чтения вами ваших исходящих).
                       Этот пароль не обязан совпадать с паролем от аккаунта.
                   </p>
               </div>
               <label>Пароль</label>
               <input autoFocus={true} type={inputType} placeholder="Пароль" id={'pwd1'} ref={password1Ref} onChange={handlePasswordChange} />
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

               <div className={classNames(styles.columns, styles.submit)}>
                   <div className={styles.cutCover}>
                       <button className={classNames('button', styles.cutButton)} type='button'
                               onClick={(e) => {
                           e.preventDefault();
                           setCut(!cut);
                       }}><span className={classNames('i', 'i-info')}></span>Инфо
                       </button>
                   </div>
                   <div><input type="submit" disabled={passwordsMatch !== true} className={styles.buttonSend} value="Создать" /></div>
                </div>

                   <div className={classNames(styles.hint, { [styles.collapsed] : cut })}>
                       <p>
                           Когда вы вводите пароль, на его основе генерируются пара ключей (публичный и приватный) для
                           шифрования секретных сообщений, <b>адресованных вам</b>. Публичный ключ не является секретом, он
                           хранится на сервере и виден другим пользователям, а приватный ключ нигде не сохраняется,
                           и используется только на вашем компьютере для расшифровки сообщений, зашифрованных с помощью публичного ключа.
                       </p>
                       <p>
                           Обратите внимание, что если вы решите сменить пароль "почтового ящика", то вместе с ним изменятся и ключи
                           шифрования. Новые сообщения <b>адресованные вам</b> (а также ваши копии исходящих сообщений)
                            будут шифроваться с помощью нового ключа, а старые сообщения,
                            зашифрованные с помощью старого ключа, можно будет прочитать только с помощью старого пароля.
                           Поэтому очень важно хорошо запоминать свои пароли или сохранять их в надежном месте.
                       </p>
                   </div>
               </form>
            </div>
        </>
    );
}
