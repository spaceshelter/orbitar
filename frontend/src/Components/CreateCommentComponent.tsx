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
import {UserGender} from '../Types/UserInfo';
import {useAPI, useAppState} from '../AppState/AppState';
import SlowMode from './SlowMode';
import {observer} from 'mobx-react-lite';

interface CreateCommentProps {
    open: boolean;
    comment?: CommentInfo;
    post?: PostLinkInfo;
    text?: string;

    onAnswer: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
}

// same as CreateCommentComponent, but with slow mode and other restrictions
export const CreateCommentComponentRestricted = observer((props: CreateCommentProps) => {
    const api = useAPI();
    const {userRestrictions} = useAppState();

    useEffect(() => {
        if (props.open) {
            api.user.refreshUserRestrictions();
        }
    }, [api, props.open]);

    if (!props.open) {
        return null;
    }

    if (userRestrictions?.restrictedToPostId && userRestrictions.restrictedToPostId !== props.post?.id) {
        return <div className={styles.answer}><RestrictedToPostIdMessage postId={userRestrictions.restrictedToPostId}/></div>;
    }

    if (userRestrictions?.commentSlowModeWaitSec) {
        return <div className={styles.answer}><RestrictedSlowMode
            endTime={new Date(Date.now() + userRestrictions.commentSlowModeWaitSec * 1000)}
            endCallback={() => api.user.refreshUserRestrictions()}/></div>;
    }

    return <CreateCommentComponent {...props} onAnswer={(text, post, comment) => {
        return props.onAnswer(text, post, comment).finally(() => {
            api.user.refreshUserRestrictions();
        });
    }}/>;
});

export default function CreateCommentComponent(props: CreateCommentProps) {
    const answerRef = useRef<HTMLTextAreaElement>(null);
    const [answerText, setAnswerText] = useState<string>(props.text || '');
    const [isPosting, setPosting] = useState(false);
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false);
    const api = useAPI();

    const pronoun = props?.comment?.author?.gender === UserGender.he ? 'ему' : props?.comment?.author?.gender===UserGender.she ? 'ей' : '';
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
        if ((props.text || props.comment) && props.open && answer) {
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
            const response = await api.postAPI.preview(answerText);
            setPreviewing(response.content);
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
                setAnswerText('');
            })
            .catch(error => {
                console.log('onAnswer ERR', error);
            })
            .finally(() => {
                setPreviewing(null);
                setPosting(false);
            });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') {
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

const RestrictedToPostIdMessage = (props: { postId: number | true }) => {
    return props.postId === true ?
        <div className={styles.restrictedToPostIdMessage}>
            Возможность комментировать в чужих постах заблокирована из-за низкой кармы.
            <a href={'/create'}>Создать свой пост.</a>
        </div>
        : <div className={styles.restrictedToPostIdMessage}>
        Возможность комментировать заблокирована из-за низкой кармы.
        Можно комментировать только в <a href={`/p${props.postId}`}>этом посте</a>.
    </div>;
};

const RestrictedSlowMode = (props: { endTime: Date; endCallback: () => void }) => {
    return <SlowMode endTime={props.endTime} endCallback={props.endCallback}>
        <div className={styles.restrictedSlowMode}>
            Возможность комментировать ограничена из-за низкой кармы. До конца ожидания осталось:
        </div>
    </SlowMode>;
};