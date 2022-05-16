import {CommentInfo, PostLinkInfo} from '../Types/PostInfo';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CreateCommentComponent.module.scss';
import postStyles from '../Pages/CreatePostPage.module.css';
import commentStyles from './CommentComponent.module.scss';
import {ReactComponent as IronyIcon} from '../Assets/irony.svg';
import {ReactComponent as ImageIcon} from '../Assets/image.svg';
import {ReactComponent as LinkIcon} from '../Assets/link.svg';
import {ReactComponent as QuoteIcon} from '../Assets/quote.svg';
import {ReactComponent as SendIcon} from '../Assets/send.svg';
import ContentComponent from './ContentComponent';
import classNames from 'classnames';
import MediaUploader from './MediaUploader';
import {UserGender} from "../Types/UserInfo";

interface CreateCommentProps {
    open: boolean;
    comment?: CommentInfo;
    post?: PostLinkInfo;

    onAnswer: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
    onPreview: (text: string) => Promise<string>;
}

export default function CreateCommentComponent(props: CreateCommentProps) {
    const answerRef = useRef<HTMLTextAreaElement>(null);

    const [answerText, setAnswerText] = useState<string>( '');
    const [isPosting, setPosting] = useState(false);
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false);

    const pronoun = props?.comment?.author?.gender == UserGender.he ? 'ему' : props?.comment?.author?.gender==UserGender.she ? 'ей' : '';
    const placeholderText = props.comment ? `Ваш ответ ${pronoun}` : '';
    const disabledButtons = isPosting || previewing !== null;

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswerText(e.target.value);
    };

    const replaceText = (text: string, cursor: number) => {
        const answer = answerRef.current;
        if (!answer) {
            return;
        }
        answer.focus();
        const start = answer.selectionStart;
        const end = answer.selectionEnd;

        const text1 = answer.value.substring(0, start);
        const text2 = answer.value.substring(end);

        const newValue = text1 + text + text2;
        answer.value = newValue;

        answer.selectionStart = start + cursor;
        answer.selectionEnd = answer.selectionStart;

        setAnswerText(newValue);
    };

    const applyTag = (tag: string) => {
        if (isPosting) {
            return;
        }

        const answer = answerRef.current;
        if (!answer) {
            return;
        }
        answer.focus();

        const start = answer.selectionStart;
        const end = answer.selectionEnd;

        const oldValue = end > start ? answer.value.substring(start, end) : '';
        let newValue = oldValue;
        let newPos = 0;

        switch (tag) {
            case 'img': {
                if (/^https?:/.test(oldValue)) {
                    // noinspection HtmlRequiredAltAttribute
                    newValue = `<img src="${oldValue}"/>`;
                    newPos = newValue.length;
                }
                else {
                    setMediaUploaderOpen(true);
                    return;
                }

                break;
            }
            case 'a': {
                let defaultValue = '';
                let textValue = oldValue;
                if (/^https?:/.test(oldValue)) {
                    defaultValue = oldValue;
                    textValue = '';
                }
                const url = window.prompt('Ссылка:', defaultValue);
                if (!url) {
                    return;
                }
                newValue = `<a href="${url}">`;
                if (textValue) {
                    newValue += `${textValue}</a>`;
                    newPos = newValue.length;
                }
                else {
                    newPos = newValue.length;
                    newValue += '</a>';
                }
                break;
            }
            default: {
                newValue = `<${tag}>${oldValue}</${tag}>`;
                newPos = newValue.length;
            }

        }

        replaceText(newValue, newPos);
    };

    useEffect(() => {
        const answer = answerRef.current;
        if (props.comment && props.open && answer) {
            answer.focus();
            answer.selectionStart = answer.value.length;
        }
    }, [props.open, props.comment]);

    const handlePreview = async () => {
        if (isPosting) {
            return;
        }
        if (previewing !== null) {
            setPreviewing(null);
            return;
        }
        setPosting(true);
        try {
            setPreviewing(await props.onPreview(answerText));
        } catch (e) {
            console.error(e);
            setPreviewing(null);
        } finally {
            setPosting(false);
        }
    };

    const handleAnswer = () => {
        setPosting(true);
        props.onAnswer(answerText, props.post, props.comment)
            .then(() => {
                setPosting(false);
                setAnswerText(props.comment ? props.comment.author.username + ', ' : '');
            })
            .catch(error => {
                console.log('ANSWER ERR', error);
                setPosting(false);
            });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey && e.code === 'Enter') {
            handleAnswer();
        }
    };

    const handleMediaUpload = (uri: string, type: 'video' | 'image') => {
        setMediaUploaderOpen(false);
        if (type === 'image') {
            // noinspection HtmlRequiredAltAttribute
            const text = `<img src="${uri}"/>`;
            replaceText(text, text.length);
        }
        else {
            const text = `<video src="${uri}"/>`;
            replaceText(text, text.length);
        }
    };

    const handleMediaUploadCancel = () => {
        setMediaUploaderOpen(false);
    };

    if (!props.open) {
        return <></>;
    }

    return (
        <div className={styles.answer}>
            <div className={styles.controls}>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('b')} className={styles.bold}>B</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('i')} className={styles.italic}>I</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('u')} className={styles.underline}>U</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('strike')} className={styles.strike}>S</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('irony')}><IronyIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('blockquote')}><QuoteIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('img')}><ImageIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('a')}><LinkIcon /></button></div>
            </div>
            {
                (previewing === null )
                ?  <div className={styles.editor}><textarea ref={answerRef} disabled={isPosting} placeholder={placeholderText} value={answerText} onChange={handleAnswerChange} onKeyDown={handleKeyDown} /></div>
                :  <div className={classNames(commentStyles.content, styles.preview, postStyles.preview)} onClick={handlePreview}><ContentComponent content={previewing} /></div>
            }
            <div className={styles.final}>
                <button disabled={isPosting || !answerText} className={styles.buttonPreview} onClick={handlePreview}>{(previewing === null) ? 'Превью' : 'Редактор'}</button>
                <button disabled={isPosting || !answerText} className={styles.buttonSend} onClick={handleAnswer}><SendIcon /></button>
                {mediaUploaderOpen && <MediaUploader onSuccess={handleMediaUpload} onCancel={handleMediaUploadCancel} />}
            </div>
        </div>
    );
}
