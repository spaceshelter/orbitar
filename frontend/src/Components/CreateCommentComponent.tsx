import {CommentInfo, PostInfo} from '../Types/PostInfo';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CreateCommentComponent.module.css';

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

        let answer = answerRef.current!;
        if (!answer) {
            return;
        }
        answer.focus();

        let start = answer.selectionStart;
        let end = answer.selectionEnd;

        let text1 = answer.value.substring(0, start);
        let text2 = end > start ? answer.value.substring(start, end) : '';
        let text3 = answer.value.substring(end);
        let isEmpty = text2.length < 1;

        switch (tag) {
            case 'img': {
                let def = '';
                if (/^https?:/.test(text2)) {
                    def = text2;
                    text2 = '';
                }

                let url = window.prompt('Адрес картинки:', def);
                if (!url) {
                    return;
                }
                text2 = `${text2}<img src="${url}">`;
                break;
            }
            case 'a': {
                let def = '';
                if (/^https?:/.test(text2)) {
                    def = text2;
                    text2 = '';
                }
                let url = window.prompt('Ссылка:', def);
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
        let newValue = `${text1}${text2}${text3}`;

        answer.value = newValue;
        answer.selectionStart = !isEmpty ? text1.length + text2.length : text1.length + tag.length + 2;
        answer.selectionEnd = answer.selectionStart;

        setAnswerText(newValue);
    };

    useEffect(() => {
        let answer = answerRef.current!;
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

    if (!props.open) {
        return <></>;
    }

    return (
        <div className={styles.answer}>
            <div className={styles.buttons}>
                <button onClick={() => applyTag('b')} className={styles.bold}>B</button>
                <button onClick={() => applyTag('i')} className={styles.italic}>I</button>
                <button onClick={() => applyTag('u')} className={styles.underline}>U</button>
                <button onClick={() => applyTag('strike')} className={styles.strike}>S</button>
                <button onClick={() => applyTag('irony')} className={styles.irony}>Irony</button>
                <button onClick={() => applyTag('img')} className={styles.image}>Image</button>
                <button onClick={() => applyTag('a')} className={styles.link}>Link</button>
            </div>
            <div><textarea ref={answerRef} disabled={isPosting} value={answerText} onChange={handleAnswerChange} /></div>
            <div><button disabled={isPosting} onClick={handleAnswer}>Ответить</button></div>
        </div>
    );
}
