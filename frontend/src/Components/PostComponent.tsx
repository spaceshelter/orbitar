import styles from './PostComponent.module.scss';
import RatingSwitch from './RatingSwitch';
import React, {useMemo, useState} from 'react';
import {PostInfo} from '../Types/PostInfo';
import ContentComponent from './ContentComponent';
import {ReactComponent as CommentsIcon} from '../Assets/comments.svg';
import {ReactComponent as OptionsIcon} from '../Assets/options.svg';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import OutsideClickHandler from 'react-outside-click-handler';

import PostLink from './PostLink';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import CreateCommentComponent from './CreateCommentComponent';
import { HistoryComponent } from './HistoryComponent';
import {SignatureComponent} from './SignatureComponent';
import Conf from '../Conf';
import {useInterpreter} from '../API/use/useInterpreter';
import {AltTranslateButton, AnnotateButton, TranslateButton, UnwatchButton, WatchButton} from './ContentButtons';
import InterpreterWrapper from './InterpreterWrapper';

interface PostComponentProps {
    post: PostInfo;
    showSite?: boolean;
    buttons?: React.ReactNode;
    onChange?: (id: number, post: Partial<PostInfo>) => void;
    autoCut?: number;
    onEdit?: (post: PostInfo, text: string, title?: string) => Promise<PostInfo | undefined>;
    dangerousHtmlTitle?: boolean;
    hideRating?: boolean;
}


export default function PostComponent(props: PostComponentProps) {
    const api = useAPI();
    const [showOptions, setShowOptions] = useState(false);
    const [editingText, setEditingText] = useState<false | string>(false);
    const [editingTitle, setEditingTitle] = useState<string>(props.post.title || '');
    const [showHistory, setShowHistory] = useState(false);
    const {currentMode, altTitle, altContent, inProgress,
        contentRef, translate, annotate, altTranslate} = useInterpreter(props.post.content, props.post.title, props.post.id, 'post');

    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            props.post.rating = value;
            props.post.vote = vote;

            if (props.onChange) {
                props.onChange(props.post.id, {
                    rating: value,
                    vote
                });
            }
        };
    }, [props]);

    const { id, created, site, author, vote, rating, watch } = props.post;
    const title = altTitle || props.post.title;
    const content = altContent || props.post.content;

    const toggleOptions = () => {
        setShowOptions(!showOptions);
    };
    const toggleWatch = () => {
        const oldState = !!props.post.watch;
        const newState = !oldState;
        props.post.watch = newState;

        api.post.watch(id, newState)
            .then(({watch}) => {
                if (props.onChange) {
                    props.onChange(props.post.id, {watch});
                }
            })
            .catch(() => {
                props.post.watch = oldState;
                toast.error('Непонятно, слежу или нет?');
            });

        setShowOptions(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleBookmark = () => {
        const oldState = !!props.post.bookmark;
        const newState = !oldState;
        props.post.bookmark = newState;

        api.post.bookmark(id, newState)
            .then(({bookmark}) => {
                if (props.onChange) {
                    props.onChange(props.post.id, {bookmark});
                }
            })
            .catch(() => {
                props.post.bookmark = oldState;
                toast.error('Кладмен мудак - закладка не найдена');
            });
    };

    const handleEditComplete = async (text: string) => {
        try {
            await props.onEdit?.(props.post, text, editingTitle);
            setEditingText(false);
            // return res;
            return undefined;
        }
        catch (err) {
            console.log('Could not edit post', err);
            toast.error('Не удалось отредактировать пост');
            throw err;
        }
    };

    const handleEdit = async () => {
        try {
            const post = await api.postAPI.get(props.post.id, 'source', true);
            setEditingText(post.post.content);
        }
        catch (e) {
            console.log('Get comment error:', e);
            toast.error('Не удалось включить редактирование');
        }
    };

    const handleEditingTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditingTitle(e.target.value);
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const altMode = currentMode !== undefined || inProgress;
    const autoCut = altMode ? undefined : props.autoCut;

    return (
        <div className={'postComponent ' + styles.post} ref={contentRef}>
            <div className={styles.header}>
                <SignatureComponent showSite={props.showSite} site={site} author={author} onHistoryClick={toggleHistory} postLink={props.post} date={created} editFlag={props.post.editFlag} />
                <div className={styles.contentContainer}>
                    {editingText === false ?
                        (showHistory
                            ? <HistoryComponent initial={{ title, content, date: created }} history={{ id: props.post.id, type: 'post' }} onClose={toggleHistory} />
                            : <>
                                    {title && <div className={styles.title}><PostLink post={props.post}>{
                                        props.dangerousHtmlTitle ? <span dangerouslySetInnerHTML={{__html: title}} /> : title
                                    }</PostLink></div>}
                                    <div className={styles.content}>
                                        <ContentComponent className={styles.content} content={content}
                                                          autoCut={autoCut}
                                                          lowRating={rating <= Conf.POST_LOW_RATING_THRESHOLD || props.post.vote === -1} />
                                    </div>
                                </>
                        )

                        :
                        <>
                            <input className={styles.title} type="text" placeholder="Без названия" maxLength={64} value={editingTitle} onChange={handleEditingTitle} />
                            <CreateCommentComponent open={true} text={editingText} onAnswer={handleEditComplete} />
                        </>
                    }
                </div>
            </div>
            <div className={styles.controls}>
                {!props.hideRating && <div className={styles.control}>
                    <RatingSwitch type='post' id={id} rating={{ vote, value: rating }} onVote={handleVote} />
                </div>}
                <div className={styles.control}><CommentsCount post={props.post} /></div>
                {/*<div className={styles.control}><button disabled={true} onClick={toggleBookmark} className={bookmark ? styles.active : ''}><BookmarkIcon /><span className={styles.label}></span></button></div>*/}
                {props.post.canEdit && props.onEdit && <div className={styles.control}><button onClick={handleEdit}><EditIcon /></button></div>}
                <div className={styles.control + ' ' + styles.options}>
                    {currentMode === 'translate' &&
                        <div className={styles.control}>
                            <TranslateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={translate}/>
                        </div>}
                    {currentMode === 'altTranslate' &&
                        <div className={styles.control}>
                            <AltTranslateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={altTranslate}/>
                        </div>}
                    {currentMode === 'annotate' &&
                        <div className={styles.control}>
                            <AnnotateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={annotate} />
                        </div>}

                    <button onClick={toggleOptions} className={styles.options + ' ' + (showOptions ? styles.active : '')}><OptionsIcon /></button>
                    {showOptions &&
                        <InterpreterWrapper content={props.post.content}>{(showAltTranslate, showAnnotate) =>
                        <OutsideClickHandler onOutsideClick={() => setShowOptions(false)}>
                        <div className={styles.optionsList}>
                            <TranslateButton className={styles.control} inProgress={inProgress} onClick={() => {setShowOptions(false);translate();}} isActive={currentMode === 'translate'} />
                            {showAltTranslate &&
                                <AltTranslateButton className={styles.control} inProgress={inProgress} onClick={() => {setShowOptions(false);altTranslate();}} isActive={currentMode === 'altTranslate'}/>}
                            {showAnnotate &&
                                <AnnotateButton className={styles.control} inProgress={inProgress} onClick={() => {setShowOptions(false);annotate();}} isActive={currentMode === 'annotate'} />}
                            {watch ? <WatchButton onClick={toggleWatch} /> : <UnwatchButton onClick={toggleWatch} />}
                        </div>
                        </OutsideClickHandler>}
                        </InterpreterWrapper>}
                </div>
            </div>
            {props.buttons}
        </div>
    );
}

function CommentsCount(props: {post: PostInfo}) {
    const {comments, newComments} = props.post;

    if (!comments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={[styles.label, styles.noComments].join(' ') }>Комментировать</span></PostLink>;
    }

    if (!newComments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    if (newComments === comments) {
        return <PostLink className={styles.active} post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    return <><PostLink className={styles.active} post={props.post} onlyNew={true}><CommentsIcon /><span className={styles.label}>{newComments}</span></PostLink> / <PostLink post={props.post}>{comments}</PostLink></>;
}
