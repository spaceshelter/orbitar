import {CommentInfo, PostInfo} from '../Types/PostInfo';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CreateCommentComponent.module.css';
import {ReactComponent as IronyIcon} from '../Assets/irony.svg';
import {ReactComponent as ImageIcon} from '../Assets/image.svg';
import {ReactComponent as LinkIcon} from '../Assets/link.svg';
import {ReactComponent as QuoteIcon} from '../Assets/quote.svg';

interface CreateCommentProps {
    open: boolean;
    comment?: CommentInfo;
    post: PostInfo;

    onAnswer: (text: string, post: PostInfo, comment?: CommentInfo) => Promise<CommentInfo>;
}

export default function CreateCommentComponent(props: CreateCommentProps) {
    const answerRef = useRef<HTMLTextAreaElement>(null);
    const [answerText, setAnswerText] = useState<string>(props.comment ? props.comment.author.username + ', ' : '');
    const [isPosting, setPosting] = useState(false);

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswerText(e.target.value);
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

        const text1 = answer.value.substring(0, start);
        let text2 = end > start ? answer.value.substring(start, end) : '';
        const text3 = answer.value.substring(end);
        const isEmpty = text2.length < 1;

        switch (tag) {
            case 'img': {
                let def = '';
                if (/^https?:/.test(text2)) {
                    def = text2;
                    text2 = '';
                }

                const url = window.prompt('Адрес картинки:', def);
                if (!url) {
                    return;
                }
                text2 = `${text2}<img src="${url}" alt="">`;
                break;
            }
            case 'a': {
                let def = '';
                if (/^https?:/.test(text2)) {
                    def = text2;
                    text2 = '';
                }
                const url = window.prompt('Ссылка:', def);
                if (!url) {
                    return;
                }
                text2 = `<a href="${url}">${text2}</a>`;
                break;
            }
            default:
                text2 = `<${tag}>${text2}</${tag}>`;

        }

        console.log('sel', start, end, {text1, text2, text3});
        const newValue = `${text1}${text2}${text3}`;

        answer.value = newValue;
        answer.selectionStart = !isEmpty ? text1.length + text2.length : text1.length + tag.length + 2;
        answer.selectionEnd = answer.selectionStart;

        setAnswerText(newValue);
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
            .then(result => {
                console.log('ANSWER', result);
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
    }

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
        </div>
    );
}
