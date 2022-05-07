import {CommentInfo, PostInfo} from '../Types/PostInfo';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CreateCommentComponent.module.css';
import {ReactComponent as IronyIcon} from '../Assets/irony.svg';
import {ReactComponent as ImageIcon} from '../Assets/image.svg';
import {ReactComponent as LinkIcon} from '../Assets/link.svg';
import {ReactComponent as QuoteIcon} from '../Assets/quote.svg';
import MediaUploader from './MediaUploader';

interface CreateCommentProps {
    open: boolean;
    comment?: CommentInfo;
    post?: PostInfo;

    onAnswer: (text: string, post?: PostInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
}

export default function CreateCommentComponent(props: CreateCommentProps) {
    const answerRef = useRef<HTMLTextAreaElement>(null);
    const [answerText, setAnswerText] = useState<string>(props.comment ? props.comment.author.username + ', ' : '');
    const [isPosting, setPosting] = useState(false);
    const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false);

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswerText(e.target.value);
    };

    const replaceText = (text: string, cursor: number) => {
        console.log('repl', text, cursor);
        const answer = answerRef.current!;
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

        const answer = answerRef.current!;
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
        const answer = answerRef.current!;
        if (props.comment && props.open && answer) {
            answer.focus();
            answer.selectionStart = answer.value.length;
        }
    }, [props.open, props.comment]);

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
            const text = `<img src="${uri}"/>`
            replaceText(text, text.length);
        }
        else {
            const text = `<video src="${uri}"/>`
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
                <div className={styles.control}><button onClick={() => applyTag('b')} className={styles.bold}>B</button></div>
                <div className={styles.control}><button onClick={() => applyTag('i')} className={styles.italic}>I</button></div>
                <div className={styles.control}><button onClick={() => applyTag('u')} className={styles.underline}>U</button></div>
                <div className={styles.control}><button onClick={() => applyTag('strike')} className={styles.strike}>S</button></div>
                <div className={styles.control}><button onClick={() => applyTag('irony')}><IronyIcon /></button></div>
                <div className={styles.control}><button onClick={() => applyTag('blockquote')}><QuoteIcon /></button></div>
                <div className={styles.control}><button onClick={() => applyTag('img')}><ImageIcon /></button></div>
                <div className={styles.control}><button onClick={() => applyTag('a')}><LinkIcon /></button></div>
            </div>
            <div className={styles.editor}><textarea ref={answerRef} disabled={isPosting} value={answerText} onChange={handleAnswerChange} onKeyDown={handleKeyDown} /></div>
            <div className={styles.final}><button disabled={isPosting || !answerText} onClick={handleAnswer}>Пыщь</button></div>
            {mediaUploaderOpen && <MediaUploader onSuccess={handleMediaUpload} onCancel={handleMediaUploadCancel} />}
        </div>
    );
}
