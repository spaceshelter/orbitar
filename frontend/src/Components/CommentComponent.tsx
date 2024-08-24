import {CommentInfo, PostLinkInfo} from '../Types/PostInfo';
import styles from './CommentComponent.module.scss';
import postStyles from './PostComponent.module.scss';
import RatingSwitch from './RatingSwitch';
import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {CreateCommentComponentRestricted} from './CreateCommentComponent';
import ContentComponent, {LARGE_AUTO_CUT} from './ContentComponent';
import {ReactComponent as OptionsIcon} from '../Assets/options.svg';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {SignatureComponent} from './SignatureComponent';
import {HistoryComponent} from './HistoryComponent';
import Conf from '../Conf';
import {useInterpreter} from '../API/use/useInterpreter';
import OutsideClickHandler from 'react-outside-click-handler';
import {AltTranslateButton, AnnotateButton, TranslateButton} from './ContentButtons';
import {InviewContext} from '../Pages/PostPage';
import {getPreferredLang, getShowInlineTranslateButton} from './UserProfileSettings';

interface CommentProps {
    comment: CommentInfo;
    showSite?: boolean;
    parent?: CommentInfo;
    onAnswer?: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
    onEdit?: (text: string, comment: CommentInfo) => Promise<CommentInfo | undefined>;
    depth?: number
    maxTreeDepth?: number
    idx?: number
    unreadOnly?: boolean
    hideRating?: boolean
    currentUsername?: string
}

export default function CommentComponent(props: CommentProps) {
    const [answerOpen, setAnswerOpen] = useState(false);
    const [editingText, setEditingText] = useState<false | string>(false);
    const [showHistory, setShowHistory] = useState(false);
    const [altContent, setAltContent] = useState<string | undefined>(undefined);
    const contentRef = useRef<HTMLDivElement>(null);
    const handleAnswer = async (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
        if (!post) {
            return undefined;
        }
        const res = await props.onAnswer?.(text, post, comment);
        setAnswerOpen(false);
        return res;
    };

    const handleEditComplete = async (text: string) => {
        try {
            const res = await props.onEdit?.(text, props.comment);
            setEditingText(false);
            return res;
        }
        catch (err) {
            console.log('Could not edit comment', err);
            toast.error('Не удалось отредактировать комментарий');
            throw err;
        }
    };


    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const {author, created, site, postLink, editFlag } = props.comment;
    const content = altContent || props.comment.content;

    const depth = props.depth || 0;
    const maxDepth = props.maxTreeDepth || 0;
    const isFlat = depth > maxDepth;
    const isInView = useContext(InviewContext);

    return (
        <div className={`comment ${styles.comment} ${props.comment.isNew ? ' isNew': ''} ${isFlat?' isFlat':''}`} data-comment-id={props.comment.id}>
            <div className='commentBody' ref={contentRef}>
                <SignatureComponent showSite={props.showSite} site={site} author={author} onHistoryClick={toggleHistory}
                                    parentCommentId={props.idx && props.parent?.id} parentCommentAuthor={props.parent?.author?.username}
                                    postLink={postLink} commentId={props.comment.id} postLinkIsNew={props.unreadOnly} date={created} editFlag={editFlag} />
                {editingText === false ?
                    (showHistory
                        ?
                            <HistoryComponent initial={{ content, date: created }} history={{ id: props.comment.id, type: 'comment' }} onClose={toggleHistory} />
                        :
                            <div className={styles.content}>
                                <ContentComponent className={styles.commentContent} content={content} currentUsername={props.currentUsername}
                                                  lowRating={props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD || props.comment.vote === -1}
                                                  autoCut={!altContent && (props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD || props.comment.vote === -1) ? LARGE_AUTO_CUT : undefined} />
                            </div>
                    )
                :
                    <CreateCommentComponentRestricted
                        post={props.comment.postLink}
                        comment={props.comment}
                        open={true} text={editingText} onAnswer={handleEditComplete} />
                }
                {isInView && <Controls {...{
                    contentRef,
                    comment: props.comment,
                    setEditingText,
                    hideRating: props.hideRating,
                    onEdit: props.onEdit,
                    onAnswer: props.onAnswer,
                    answerOpen,
                    setAnswerOpen,
                    setAltContent
                }}/>}
            </div>
            {(props.comment.answers || answerOpen) ?
                <div className={styles.answers + (isFlat?' isFlat':'')}>
                    {props.onAnswer && <CreateCommentComponentRestricted open={answerOpen} post={props.comment.postLink}
                                                                         comment={props.comment} onAnswer={handleAnswer}
                                                                         storageKey={`cp:${props.comment.id}`}/>}
                    {props.comment.answers && props.onAnswer ? props.comment.answers.map( (comment, idx) =>
                        <CommentComponent maxTreeDepth={maxDepth} depth={depth+1} parent={props.comment} key={comment.id}
                                          comment={comment} onAnswer={props.onAnswer} onEdit={props.onEdit} unreadOnly={props.unreadOnly} idx={idx}
                                          currentUsername={props.currentUsername}
                        />) : <></>}
                </div>
                : <></>}

        </div>
    );
}

interface ControlsProps {
    contentRef: React.RefObject<HTMLDivElement>;
    comment: CommentInfo;
    setEditingText: (text: string) => void;
    hideRating?: boolean;
    onEdit?: (text: string, comment: CommentInfo) => Promise<CommentInfo | undefined>;
    onAnswer?: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
    answerOpen: boolean;
    setAnswerOpen: (value: boolean) => void;
    setAltContent: (value: string | undefined) => void;
}

function Controls({contentRef, comment, setEditingText, hideRating, onEdit, onAnswer, answerOpen, setAnswerOpen, setAltContent: setCommentAltContent}: ControlsProps) {
    const api = useAPI();

    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            comment.rating = value;
            comment.vote = vote;
        };
    }, [comment]);
    const handleEdit = async () => {
        try {
            const commentResponse = await api.postAPI.getComment(comment.id, 'source');
            setEditingText(commentResponse.comment.content);
        }
        catch (e) {
            console.log('Get comment error:', e);
            toast.error('Не удалось включить редактирование');
        }
    };

    const [showOptions, setShowOptions] = useState(false);
    const toggleOptions = () => {
        setShowOptions(!showOptions);
    };


    const {currentMode, inProgress, altContent, translate, annotate, altTranslate,
        calcShowAnnotate, calcShowAltTranslate
    } = useInterpreter(contentRef, comment.content, undefined, comment.id, 'comment');
    const handleAnswerSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setAnswerOpen(!answerOpen);
    };
    useEffect(() => setCommentAltContent(altContent), [setCommentAltContent, altContent]);
    const showTranslateButtonInline = useMemo(() => {
        return getShowInlineTranslateButton() && comment.language !== getPreferredLang();
    }, [comment]);

    return (
      <div className={styles.controls}>
        {!hideRating &&
          <div className={styles.control}>
              <RatingSwitch type="comment" id={comment.id} rating={{ vote: comment.vote, value: comment.rating }} onVote={handleVote} />
          </div>}
        {comment.canEdit && onEdit && <div className={styles.control}><button onClick={handleEdit} className='i i-edit' /></div>}

        <div className={styles.control + ' ' + postStyles.options}>
            {(showTranslateButtonInline || currentMode === 'translate') &&
              <div className={styles.control}>
                  <TranslateButton iconOnly={true} isActive={currentMode === 'translate'} inProgress={inProgress} onClick={translate} />
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
              <OutsideClickHandler onOutsideClick={() => setShowOptions(false)}>
                  <div className={postStyles.optionsList}>
                      {!showTranslateButtonInline && <TranslateButton inProgress={inProgress} onClick={() => {setShowOptions(false);translate();}} isActive={currentMode === 'translate'} />}
                      {calcShowAltTranslate() &&
                        <AltTranslateButton inProgress={inProgress} onClick={() => {setShowOptions(false);altTranslate();}} isActive={currentMode === 'altTranslate'}/>}
                      {calcShowAnnotate() &&
                        <AnnotateButton inProgress={inProgress} onClick={() => {setShowOptions(false);annotate();}} isActive={currentMode === 'annotate'} />}
                  </div>
              </OutsideClickHandler>}
        </div>
        {onAnswer && <div className={styles.control}><button onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</button></div>}
    </div>
    );

}