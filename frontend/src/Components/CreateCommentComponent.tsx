import { CommentInfo, PostLinkInfo } from '../Types/PostInfo';
import React, { useEffect, useRef, useState } from 'react';
import styles from './CreateCommentComponent.module.scss';
import postStyles from '../Pages/CreatePostPage.module.css';
import commentStyles from './CommentComponent.module.scss';
import { ReactComponent as IronyIcon } from '../Assets/irony.svg';
import { ReactComponent as ImageIcon } from '../Assets/image.svg';
import { ReactComponent as SpoilerIcon } from '../Assets/spoiler.svg';
import { ReactComponent as ExpandIcon } from '../Assets/expand.svg';
import { ReactComponent as LinkIcon } from '../Assets/link.svg';
import { ReactComponent as QuoteIcon } from '../Assets/quote.svg';
import { ReactComponent as CodeIcon } from '../Assets/code-slash.svg';
import { ReactComponent as SendIcon } from '../Assets/send.svg';
import ContentComponent from './ContentComponent';
import classNames from 'classnames';
import MediaUploader from './MediaUploader';
import { UserGender } from '../Types/UserInfo';
import { useAPI, useAppState } from '../AppState/AppState';
import SlowMode from './SlowMode';
import { observer } from 'mobx-react-lite';
import { useDebouncedCallback } from 'use-debounce';
import ThemeToggleComponent from './ThemeToggleComponent';
import getCaretCoordinates from 'textarea-caret';
import { toast } from 'react-toastify';
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete';
import TextareaAutosize from 'react-textarea-autosize';
import debouncePromise from 'debounce-promise';
import { useHotkeys } from 'react-hotkeys-hook';

interface CreateCommentProps {
    open: boolean;
    comment?: CommentInfo;
    post?: PostLinkInfo;
    text?: string;
    storageKey?: string;

    onAnswer: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | string | undefined>;
}

// same as CreateCommentComponent, but with slow mode and other restrictions
export const CreateCommentComponentRestricted = observer((props: CreateCommentProps) => {
    const api = useAPI();
    const { userRestrictions } = useAppState();

    useEffect(() => {
        if (props.open) {
            api.user.refreshUserRestrictions();
        }
    }, [api, props.open]);

    if (!props.open) {
        return null;
    }

    if (userRestrictions?.restrictedToPostId && userRestrictions.restrictedToPostId !== props.post?.id) {
        return <div className={styles.answer}><RestrictedToPostIdMessage postId={userRestrictions.restrictedToPostId} /></div>;
    }

    if (userRestrictions?.commentSlowModeWaitSecRemain) {
        return <div className={styles.answer}><RestrictedSlowMode
            endTime={new Date(Date.now() + userRestrictions.commentSlowModeWaitSecRemain * 1000)}
            endCallback={() => api.user.refreshUserRestrictions()} /></div>;
    }

    return <CreateCommentComponent {...props} onAnswer={(text, post, comment) => {
        return props.onAnswer(text, post, comment).finally(() => {
            api.user.refreshUserRestrictions();
        });
    }} />;
});

const Item = (item: { entity: string }) => {
    return <div>{`${item.entity}`}</div>;
};

const allowedKeys = [
    'ctrl+enter',
    'meta+enter',
    'ctrl+b',
    'meta+b',
    'ctrl+i',
    'meta+i',
    'ctrl+u',
    'meta+u',
    'ctrl+k',
    'meta+k',
    'ctrl+shift+x',
    'meta+shift+x'
];

export default function CreateCommentComponent(props: CreateCommentProps) {
    const answerRef = useRef<HTMLTextAreaElement>();
    const [answerText, setAnswerText] = useState<string>(props.text ||
        (props.storageKey && localStorage.getItem('crCmp:' + props.storageKey)) || '');
    const [isPosting, setPosting] = useState(false);
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false);
    const containerRef = useHotkeys<HTMLDivElement>(allowedKeys.join(','), (e) => handleHotKey(e), { enableOnFormTags: ['TEXTAREA'] });
    const api = useAPI();

    const pronoun = props?.comment?.author?.gender === UserGender.he ? 'ему' : props?.comment?.author?.gender === UserGender.she ? 'ей' : '';
    const placeholderText = props.comment ? `Ваш ответ ${pronoun}` : '';
    const disabledButtons = isPosting || previewing !== null;

    const setStorageValueDebounced = useDebouncedCallback((value) => {
        if (props.storageKey) {
            if (value) {
                localStorage.setItem('crCmp:' + props.storageKey, value);
            } else {
                localStorage.removeItem('crCmp:' + props.storageKey);
            }
        }
    });

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setStorageValueDebounced(e.target.value);
        setAnswerText(e.target.value);
    };

    const handleHotKey = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();

        if ((e.ctrlKey || e.metaKey) && key === 'b') applyTag('b');
        if ((e.ctrlKey || e.metaKey) && key === 'i') applyTag('i');
        if ((e.ctrlKey || e.metaKey) && key === 'u') applyTag('u');
        if ((e.ctrlKey || e.metaKey) && key === 'k') applyTag('a');
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'x') applyTag('strike');
        if ((e.ctrlKey || e.metaKey) && key === 'enter') handleAnswer();
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

        setStorageValueDebounced(newValue);
        setAnswerText(newValue);

        setTimeout(() => {
            if (!answer) {
                return;
            }
            answer.selectionStart = start + cursor;
            answer.selectionEnd = answer.selectionStart;
        });
    };

    const applyTag = (tag: string, attrs?: { [name: string]: string }) => {
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
            case 'pre': {
                const escapedValue = oldValue.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                newValue = `<pre>${escapedValue}</pre>`;
                newPos = newValue.length;
                break;
            }
            default: {
                const textAttrs = !attrs ? '' : Object.keys(attrs).reduce((_, name) => `${_} ${name}="${attrs[name]}"`, '');
                newValue = `<${tag}${textAttrs}>${oldValue}</${tag}>`;
                newPos = oldValue ? newValue.length : newValue.length - `</${tag}>`.length;
            }

        }

        replaceText(newValue, newPos);
    };

    useEffect(() => {
        if ((props.text || props.comment) && props.open && answerRef.current) {
            answerRef.current.focus();
            answerRef.current.selectionStart = answerRef.current.value.length;
        }
    }, [props.open, props.comment]);

    useEffect(() => {
        if (
            !answerRef.current ||
            !containerRef.current
        ) {
            return;
        }
        const { top, left } = getCaretCoordinates(answerRef.current, answerRef.current.selectionEnd);
        const suggestResults = containerRef.current?.querySelector('.textarea-suggest__results ') as HTMLDivElement;
        if (!suggestResults) {
            return;
        }
        suggestResults.style.setProperty('top', top.toString() + 'px');
        suggestResults.style.setProperty('left', left.toString() + 'px');
    });

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

    const previewIgnoredTagNames = ['A', 'SUMMARY', 'VIDEO'];
    const handleClosePreview = async (e: React.MouseEvent) => {
        const el = e.target as HTMLElement;
        if (isPosting ||
            previewIgnoredTagNames.includes(el.tagName) ||
            el.getAttribute('role') === 'button' ||
            el.classList.contains('image-scalable')
        ) {
            return;
        }
        setPreviewing(null);
    };

    const handleAnswer = () => {
        setPosting(true);
        props.onAnswer(answerText, props.post, props.comment)
            .then(() => {
                setStorageValueDebounced('');
                setStorageValueDebounced.flush();
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

    const debounceSuggestError = useDebouncedCallback((error: string) => {
        toast(error, { type: 'error' });
    }, 5000, { leading: true, trailing: false, maxWait: 10000 });

    const fetchUsernameSuggestions = async (startsWith: string) => {
        try {
            const result = await api.userAPI.getUsernameSuggestions(startsWith);
            return result.usernames;
        } catch (e) {
            debounceSuggestError((e as any).message);
            return [];
        }
    };

    if (!props.open) {
        return <></>;
    }

    const fetchUsernameSuggestionsDebounced = debouncePromise(fetchUsernameSuggestions, 50);
    const suggestTrigger = {
        '@': {
            dataProvider: async (startsWith: string) => {
                if (!answerRef.current) {
                    return [];
                }
                return fetchUsernameSuggestionsDebounced(startsWith);
            },
            component: Item,
            output: (item: string) => '@' + item
        }
    };

    return (
        <div className={styles.answer}>
            <div className={styles.controls}>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('b')} title="Болд" className={styles.bold}>B</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('i')} title="Италик" className={styles.italic}>I</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('u')} title="Подчеркнуть" className={styles.underline}>U</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('strike')} title="Перечеркнуть" className={styles.strike}>S</button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('irony')} title="Ирония"><IronyIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('spoiler')} title="Спойлер"><SpoilerIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('expand', { 'title': '' })} title="Свернуть/Развернуть"><ExpandIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('blockquote')} title="Цитировать"><QuoteIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('pre')} title="Вставить форматированный текст"><CodeIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('img')} title="Вставить картинку/видео"><ImageIcon /></button></div>
                <div className={styles.control}><button disabled={disabledButtons} onClick={() => applyTag('a')} title="Вставить ссылку"><LinkIcon /></button></div>
            </div>
            {
                (previewing === null)
                    ? <div className={styles.editor} ref={containerRef}>
                        <ReactTextareaAutocomplete<string>
                            placeholder={placeholderText}
                            innerRef={(el: HTMLTextAreaElement) => {
                                answerRef.current = el;
                            }}
                            dropdownClassName={styles.textareaSuggestContainer}
                            loadingComponent={() => <></>}
                            minChar={1}
                            disabled={isPosting}
                            onChange={handleAnswerChange}
                            value={answerText}
                            // @ts-expect-error -- types of react-textarea-autosize and react-textarea-autocomplete are incompatible with their latest versions
                            textAreaComponent={TextareaAutosize}
                            maxRows={25}
                            movePopupAsYouType={true}
                            trigger={suggestTrigger}
                        />
                    </div>
                    : <div className={classNames(commentStyles.content, styles.preview, postStyles.preview)}
                        onClick={handleClosePreview}><ContentComponent content={previewing} /></div>
            }
            <div className={styles.final}>
                {previewing && (
                    <ThemeToggleComponent buttonLabel='Превью с другой темой' resetOnOnmount={true} />
                )}
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
